import { OpenAI } from 'openai';
import { TranscriptSegment } from '@prisma/client';
import { downloadYouTubeAudio, cleanupTempFiles } from './audio-utils';
import { prisma } from './prisma';
import * as path from 'path';
import * as fs from 'fs/promises';
import { spawn } from 'child_process';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

interface CodeSnippet {
  language: string;
  code: string;
  explanation: string;
  startTime: number;
  endTime: number;
}

export interface ProcessingProgress {
  stage: 'downloading' | 'converting' | 'transcribing' | 'analyzing' | 'complete' | 'error';
  progress: number; // 0-100
  message: string;
}

type ProgressCallback = (progress: ProcessingProgress) => void;

export async function processVideo(
  videoId: string,
  onProgress?: ProgressCallback
): Promise<{
  transcriptSegments: TranscriptSegment[];
  codeSnippets: CodeSnippet[];
}> {
  let tempPath: string | null = null;
  let mp3Path: string | null = null;

  try {
    // Download audio
    onProgress?.({
      stage: 'downloading',
      progress: 0,
      message: 'Starting audio download...'
    });
    
    tempPath = path.join(process.cwd(), 'temp', `${videoId}-audio.webm`);
    if (!videoId) {
      throw new Error('Invalid video ID');
    }
    await downloadYouTubeAudio(videoId, tempPath);
    
    onProgress?.({
      stage: 'converting',
      progress: 25,
      message: 'Converting audio format...'
    });
    
    // Convert audio to mp3 format
    mp3Path = path.join(process.cwd(), 'temp', `${videoId}-audio.mp3`);
    await fs.rename(tempPath, mp3Path);

    // Generate transcript
    onProgress?.({
      stage: 'transcribing',
      progress: 50,
      message: 'Generating transcript...'
    });
    
    const transcriptSegments = await generateTranscript(videoId, mp3Path);

    // Extract code snippets
    onProgress?.({
      stage: 'analyzing',
      progress: 75,
      message: 'Extracting code snippets...'
    });
    
    const codeSnippets = await extractCodeSnippets(transcriptSegments);

    // Cleanup temporary files
    try {
      if (tempPath) {
        await cleanupTempFiles(tempPath);
      }
      if (mp3Path) {
        await cleanupTempFiles(mp3Path);
      }
    } catch (cleanupError) {
      console.error('Error cleaning up temporary files:', cleanupError);
      // Don't throw cleanup errors as the main process succeeded
    }

    onProgress?.({
      stage: 'complete',
      progress: 100,
      message: 'Processing complete!'
    });

    return {
      transcriptSegments,
      codeSnippets,
    };
  } catch (error) {
    console.error('Error processing video:', error);
    // Cleanup on error
    if (tempPath) {
      try {
        await cleanupTempFiles(tempPath);
      } catch (e) {
        console.error('Error cleaning up temp file:', e);
      }
    }
    if (mp3Path) {
      try {
        await cleanupTempFiles(mp3Path);
      } catch (e) {
        console.error('Error cleaning up mp3 file:', e);
      }
    }
    
    onProgress?.({
      stage: 'error',
      progress: 0,
      message: error instanceof Error ? error.message : 'An error occurred during processing'
    });
    throw error;
  }
}

export async function downloadYouTubeVideo(videoId: string, outputPath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    // Ensure output directory exists
    const outputDir = path.dirname(outputPath);
    fs.mkdir(outputDir, { recursive: true }).catch(console.error);

    const ytDlp = spawn('yt-dlp', [
      `https://www.youtube.com/watch?v=${videoId}`,
      '--format', 'bestvideo[ext=mp4]+bestaudio[ext=m4a]/mp4',
      '--merge-output-format', 'mp4',
      '--output', outputPath,
      '--no-playlist',
    ]);

    ytDlp.stderr.on('data', (data) => {
      console.error(`yt-dlp Error: ${data}`);
    });

    ytDlp.stdout.on('data', (data) => {
      console.log(`yt-dlp Output: ${data}`);
    });

    ytDlp.on('close', (code) => {
      if (code === 0) {
        resolve(outputPath);
      } else {
        reject(new Error(`yt-dlp process exited with code ${code}`));
      }
    });
  });
}

async function generateTranscript(videoId: string, audioPath: string): Promise<TranscriptSegment[]> {
  try {
    const audioFile = await fetch('file://' + audioPath);
    const transcription = await openai.audio.transcriptions.create({
      file: audioFile,
      model: 'whisper-1',
      response_format: 'verbose_json',
      timestamp_granularities: ['segment'],
    });

    // Create a transcript record first
    const transcript = await prisma.transcript.create({
      data: {
        videoId,
        content: transcription.text,
      },
    });

    // Map segments to TranscriptSegment model format
    const segments = transcription.segments?.map((segment) => ({
      id: '', // Will be set by Prisma
      transcriptId: transcript.id, // Link to the transcript
      text: segment.text,
      startTime: typeof segment.start === 'string' ? parseFloat(segment.start) : segment.start,
      endTime: typeof segment.end === 'string' ? parseFloat(segment.end) : segment.end,
      createdAt: new Date(),
      updatedAt: new Date(),
    })) ?? [];

    // If no segments, create a single segment from the full text
    if (segments.length === 0 && transcription.text) {
      const duration = typeof transcription.duration === 'string' 
        ? parseFloat(transcription.duration) 
        : transcription.duration ?? 0;

      segments.push({
        id: '', // Will be set by Prisma
        transcriptId: transcript.id,
        text: transcription.text,
        startTime: 0,
        endTime: duration,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }

    return segments;
  } catch (error) {
    console.error('Error generating transcript:', error);
    throw error;
  }
}

async function extractCodeSnippets(
  transcriptSegments: TranscriptSegment[]
): Promise<CodeSnippet[]> {
  try {
    const prompt = `You are an expert at identifying and extracting code snippets from video transcripts.
Given the following transcript segments, please identify and extract any code snippets being discussed.
For each code snippet:
1. Determine the programming language
2. Extract or reconstruct the actual code
3. Provide a brief explanation of what the code does
4. Note the start and end timestamps

Format your response as a JSON array of objects with these fields:
{
  "language": "programming language",
  "code": "the actual code",
  "explanation": "brief explanation",
  "startTime": start timestamp in seconds,
  "endTime": end timestamp in seconds
}

Transcript segments:
${transcriptSegments
  .map(
    (segment) =>
      `[${segment.startTime.toFixed(2)} - ${segment.endTime.toFixed(2)}] ${
        segment.text
      }`
  )
  .join('\n')}`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [
        {
          role: 'system',
          content:
            'You are an expert at identifying and extracting code snippets from video transcripts.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      response_format: { type: 'json_object' },
    });

    const content = completion.choices[0]?.message?.content;
    
    if (!content) {
      console.warn('No code snippets found in transcript');
      return [];
    }

    try {
      const parsedResponse = JSON.parse(content);
      return parsedResponse.snippets || [];
    } catch (error) {
      console.error('Error parsing GPT response:', error);
      return [];
    }
  } catch (error) {
    console.error('Error extracting code snippets:', error);
    throw error;
  }
}
