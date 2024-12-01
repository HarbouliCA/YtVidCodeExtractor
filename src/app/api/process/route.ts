import { NextResponse } from 'next/server';
import { downloadYouTubeAudio, transcribeAudio, cleanupTempFiles } from '@/lib/audio-utils';
import path from 'path';
import os from 'os';

// In-memory store for progress updates
const progressUpdates = new Map<string, any>();

function extractVideoId(videoUrl: string) {
  const videoId = videoUrl.split('v=')[1].split('&')[0];
  return videoId;
}

export async function POST(request: Request) {
  let videoId: string | null = null;
  
  try {
    const { videoUrl } = await request.json();
    if (!videoUrl) {
      return NextResponse.json({ success: false, error: 'No video URL provided' }, { status: 400 });
    }

    // Extract video ID from URL
    videoId = extractVideoId(videoUrl);
    if (!videoId) {
      return NextResponse.json({ success: false, error: 'Invalid YouTube URL' }, { status: 400 });
    }

    // Initialize progress
    progressUpdates.set(videoId, {
      stage: 'downloading',
      progress: 0,
      message: 'Starting download...'
    });

    // Create temp directory if it doesn't exist
    const tempDir = path.join(os.tmpdir(), 'codesnippet');
    const outputPath = path.join(tempDir, `${videoId}.mp3`);

    // Download audio
    console.log('Downloading audio...');
    const audioPath = await downloadYouTubeAudio(videoId, outputPath, (progress) => {
      if (!videoId) return; // TypeScript safety check
      progressUpdates.set(videoId, {
        stage: 'downloading',
        progress: progress * 0.6, // 60% of total progress
        message: `Downloading audio: ${progress}%`
      });
    });

    // Transcribe audio
    console.log('Transcribing audio...');
    const transcription = await transcribeAudio(audioPath, (progress) => {
      if (!videoId) return; // TypeScript safety check
      progressUpdates.set(videoId, {
        stage: 'transcribing',
        progress: 60 + (progress * 0.4), // Remaining 40% of progress
        message: `Transcribing audio: ${progress}%`
      });
    });

    // Clean up audio file
    await cleanupTempFiles(audioPath);

    // Set final progress and result
    const result = { success: true, transcription, message: 'Processing complete' };
    progressUpdates.set(videoId, {
      stage: 'complete',
      progress: 100,
      message: 'Processing complete',
      result
    });

    return NextResponse.json(result);

  } catch (error: unknown) {
    console.error('Error processing video:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    
    if (videoId) {
      progressUpdates.set(videoId, {
        stage: 'error',
        progress: 0,
        message: errorMessage
      });
    }
    
    return NextResponse.json({ success: false, error: errorMessage }, { status: 500 });
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
