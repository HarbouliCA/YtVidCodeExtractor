import { NextResponse } from 'next/server';
import { downloadYouTubeAudio, transcribeAudio, cleanupTempFiles, type TranscriptionSegment } from '@/lib/audio-utils';
import { extractFrames } from '@/lib/frame-utils';
import { downloadYouTubeVideo } from '@/lib/video-processor';
import path from 'path';
import os from 'os';
import { promises as fs } from 'fs';
import { requireAuth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

// Define types for transcript data
interface TranscriptData {
  segments: TranscriptionSegment[];
  metadata: {
    totalDuration: number;
    segmentCount: number;
    lastUpdated: string;
  };
}

// In-memory store for progress updates
const progressUpdates = new Map<string, any>();

function extractYouTubeId(url: string): string | null {
  try {
    const videoUrl = new URL(url);
    const searchParams = new URLSearchParams(videoUrl.search);
    return searchParams.get('v');
  } catch (error) {
    console.error('Error parsing YouTube URL:', error);
    return null;
  }
}

// Helper function to detect content type in transcription
function detectContentType(text: string): 'code' | 'explanation' | 'other' {
  // Code indicators
  const codeKeywords = [
    'function', 'class', 'const', 'let', 'var',
    'if', 'else', 'for', 'while', 'return',
    'import', 'export', 'async', 'await'
  ];
  
  const codeSymbols = ['{', '}', '(', ')', '[', ']', ';', '=>', '===', '!=='];
  
  // Check for code patterns
  const hasCodeKeywords = codeKeywords.some(keyword => 
    new RegExp(`\\b${keyword}\\b`).test(text.toLowerCase())
  );
  
  const hasCodeSymbols = codeSymbols.some(symbol => text.includes(symbol));
  
  // Explanation indicators
  const explanationPhrases = [
    'this means', 'let me explain', 'basically',
    'in other words', 'what this does', 'this is how'
  ];
  
  const isExplanation = explanationPhrases.some(phrase => 
    text.toLowerCase().includes(phrase)
  );
  
  if (hasCodeKeywords || hasCodeSymbols) return 'code';
  if (isExplanation) return 'explanation';
  return 'other';
}

// Helper function to parse transcript into segments
function parseTranscript(transcript: string): TranscriptionSegment[] {
  // Split transcript into sentences
  const sentences = transcript.split(/[.!?]+/).filter(Boolean);
  
  let currentTime = 0;
  const AVERAGE_WORDS_PER_SECOND = 2.5; // Assuming average speaking rate
  
  return sentences.map(sentence => {
    const words = sentence.trim().split(/\s+/).length;
    const duration = words / AVERAGE_WORDS_PER_SECOND;
    
    const segment: TranscriptionSegment = {
      start: currentTime,
      end: currentTime + duration,
      text: sentence.trim(),
      type: detectContentType(sentence)
    };
    
    currentTime += duration;
    return segment;
  });
}

export async function POST(request: Request) {
  let videoId: string | null = null;
  let tempDir: string | null = null;
  
  try {
    let userId: string;
    
    // Skip authentication in development
    if (process.env.NODE_ENV !== 'production') {
      console.log('Skipping auth in development mode');
      // Create or find test user
      const testUser = await prisma.user.upsert({
        where: { email: 'test@example.com' },
        update: {},
        create: {
          email: 'test@example.com',
          clerkId: 'test_clerk_id',
          name: 'Test User'
        }
      });
      userId = testUser.id;
    } else {
      const user = await requireAuth();
      userId = user.id;
    }

    const { videoUrl } = await request.json();
    if (!videoUrl) {
      return NextResponse.json({ error: 'Video URL is required' }, { status: 400 });
    }

    // Extract video ID from URL
    videoId = extractYouTubeId(videoUrl);
    if (!videoId) {
      return NextResponse.json({ error: 'Invalid YouTube URL' }, { status: 400 });
    }

    // Create video record in database
    const video = await prisma.video.create({
      data: {
        youtubeId: videoId,
        title: videoId, // We'll update this later with actual title
        status: 'PROCESSING',
        userId: userId,
      },
    });

    // Create temp directory for processing
    tempDir = path.join(os.tmpdir(), `codesnippet-frames-${Date.now()}`);
    await fs.mkdir(tempDir, { recursive: true });

    // Download video
    const videoPath = await downloadYouTubeVideo(videoId, path.join(tempDir, `${videoId}.mp4`));
    
    // Download and transcribe audio
    progressUpdates.set(videoId, {
      stage: 'transcribing',
      progress: 30,
      message: 'Downloading and transcribing audio...'
    });

    const audioPath = path.join(tempDir, `${videoId}.mp3`);
    await downloadYouTubeAudio(videoId, audioPath);
    const rawTranscript = await transcribeAudio(audioPath);

    // Parse the raw transcript into segments
    const transcriptionSegments = parseTranscript(rawTranscript);

    // Save transcription to database
    const transcriptData = {
      segments: transcriptionSegments.map(segment => ({
        ...segment,
        text: segment.text.trim(),
        type: segment.type || 'other'
      })),
      metadata: {
        totalDuration: transcriptionSegments[transcriptionSegments.length - 1].end,
        segmentCount: transcriptionSegments.length,
        lastUpdated: new Date().toISOString()
      }
    } as const;

    await prisma.$executeRaw`
      UPDATE Video 
      SET transcript = ${JSON.stringify(transcriptData)}
      WHERE id = ${video.id}
    `;

    // Update progress for frame extraction
    progressUpdates.set(videoId, {
      stage: 'processing',
      progress: 50,
      message: 'Extracting frames and performing OCR...'
    });
    
    // Extract frames
    console.log('Extracting frames...');
    const frames = await extractFrames(videoPath, tempDir, videoId);

    // Save frames to database
    if (frames.length > 0) {
      await prisma.frame.createMany({
        data: frames.map(frame => ({
          videoId: video.id,
          url: frame.url,
          timestamp: frame.timestamp,
          hasCode: frame.hasCode,
          text: frame.text || '',
        }))
      });
    }

    // Update video status and progress
    await prisma.video.update({
      where: { id: video.id },
      data: { status: 'COMPLETED' }
    });

    progressUpdates.set(videoId, {
      stage: 'complete',
      progress: 100,
      message: 'Processing completed',
      data: {
        videoId: video.id,
        frameCount: frames.length,
        transcript: transcriptData
      }
    });

    return NextResponse.json({ 
      success: true, 
      videoId: video.id,
      frames 
    });

  } catch (error) {
    console.error('Error processing video:', error);

    if (videoId) {
      try {
        // First find the video by youtubeId
        const video = await prisma.video.findFirst({
          where: { youtubeId: videoId }
        });

        if (video) {
          await prisma.video.update({
            where: { id: video.id },
            data: { status: 'FAILED' }
          });
        }
      } catch (dbError) {
        console.error('Error updating video status:', dbError);
      }
    }

    return NextResponse.json({ 
      error: error instanceof Error ? error.message : 'An unknown error occurred' 
    }, { status: 500 });

  } finally {
    // Cleanup temp directory
    if (tempDir) {
      try {
        await fs.rm(tempDir, { recursive: true, force: true });
      } catch (error) {
        console.error('Error cleaning up temp directory:', error);
      }
    }
  }
}

// Progress endpoint
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const videoId = searchParams.get('videoId');

    if (!videoId) {
      return NextResponse.json({ error: 'No videoId provided' }, { status: 400 });
    }

    const progress = progressUpdates.get(videoId);
    if (!progress) {
      return NextResponse.json({
        stage: 'unknown',
        progress: 0,
        message: 'No progress data available'
      });
    }

    // If complete or error, remove the progress data after sending it
    if (progress.stage === 'complete' || progress.stage === 'error') {
      progressUpdates.delete(videoId);
    }

    return NextResponse.json(progress);
  } catch (error) {
    console.error('Error fetching progress:', error);
    return NextResponse.json({ 
      stage: 'error',
      progress: 0,
      message: 'Failed to fetch progress'
    }, { status: 500 });
  }
}
