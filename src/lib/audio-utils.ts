import ytdl, { chooseFormatOptions } from 'ytdl-core';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { FFmpeg } from '@ffmpeg/ffmpeg';
import { toBlobURL, fetchFile } from '@ffmpeg/util';
import { google } from 'googleapis';
import { Readable } from 'stream';
import fetch from 'node-fetch';
import * as play from 'play-dl';
import { exec, spawn } from 'child_process';
import { promisify } from 'util';
const execAsync = promisify(exec);

// Define types from play-dl
type InfoData = Awaited<ReturnType<typeof play.video_info>>;
type YouTubeStream = Readable;
type StreamOptions = Parameters<typeof play.stream_from_info>[1];

// Initialize play-dl
play.setToken({
  youtube: {
    cookie: process.env.YOUTUBE_COOKIE || ''
  }
});

// Use os.tmpdir() for temporary files
const TEMP_DIR = path.join(os.tmpdir(), 'codesnippet-audio');

async function ensureTempDir(): Promise<void> {
  try {
    await fs.promises.access(TEMP_DIR);
  } catch {
    await fs.promises.mkdir(TEMP_DIR, { recursive: true });
  }
}

async function ensureDir(dir: string) {
  try {
    await fs.promises.access(dir);
  } catch {
    await fs.promises.mkdir(dir, { recursive: true });
  }
}

function getTempFilePath(videoId: string, attempt: number = 0): string {
  const timestamp = Date.now();
  return path.join(TEMP_DIR, `${videoId}_${timestamp}_${attempt}.webm`);
}

function getTempMp3Path(videoId: string, attempt: number = 0): string {
  const timestamp = Date.now();
  return path.join(TEMP_DIR, `${videoId}_${timestamp}_${attempt}.mp3`);
}

async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export async function cleanupTempFiles(filePath: string): Promise<void> {
  try {
    if (!fs.existsSync(filePath)) {
      return;
    }
    
    // Try to make the file writable first
    try {
      await fs.promises.chmod(filePath, 0o666);
    } catch (chmodError) {
      console.warn('Failed to change file permissions:', chmodError);
      // Continue anyway
    }

    await fs.promises.unlink(filePath);
    console.log(`Cleaned up temp file: ${filePath}`);
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
      return;
    }
    console.error(`Error cleaning up temp file ${filePath}:`, error);
  }
}

async function cleanupVideoTempFiles(videoId: string): Promise<void> {
  try {
    const files = await fs.promises.readdir(TEMP_DIR);
    const cleanupPromises = files
      .filter(file => file.includes(videoId))
      .map(file => cleanupTempFiles(path.join(TEMP_DIR, file)));
    await Promise.all(cleanupPromises);
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
      // Temp directory doesn't exist yet, that's fine
      return;
    }
    console.error('Error cleaning up video temp files:', error);
  }
}

const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
];

function getRandomUserAgent() {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

async function getCookies(videoId: string): Promise<string> {
  try {
    const response = await fetch(`https://www.youtube.com/watch?v=${videoId}`, {
      headers: {
        'User-Agent': getRandomUserAgent(),
      },
    });
    const cookies = response.headers.get('set-cookie');
    return cookies || '';
  } catch (error) {
    console.warn('Failed to get cookies:', error);
    return '';
  }
}

async function downloadWithFetch(url: string, outputPath: string, cookies: string): Promise<void> {
  const headers: Record<string, string> = {
    'User-Agent': getRandomUserAgent(),
    'Accept': '*/*',
    'Accept-Language': 'en-US,en;q=0.9',
    'Accept-Encoding': 'gzip, deflate, br',
    'Range': 'bytes=0-',
    'Referer': 'https://www.youtube.com/',
    'Origin': 'https://www.youtube.com',
    'Connection': 'keep-alive',
  };

  if (cookies) {
    headers['Cookie'] = cookies;
  }

  const response = await fetch(url, { headers });
  
  if (!response.ok) {
    throw new Error(`Status code: ${response.status}`);
  }

  const fileStream = fs.createWriteStream(outputPath);
  const body = await response.arrayBuffer();
  fileStream.write(Buffer.from(body));
  await new Promise((resolve) => fileStream.end(resolve));
}

type VideoQualityLabel = 
    | "144p" | "144p 15fps" | "144p60 HDR"
    | "240p" | "240p60 HDR"
    | "270p"
    | "360p" | "360p60 HDR"
    | "480p" | "480p60 HDR"
    | "720p" | "720p60" | "720p60 HDR"
    | "1080p" | "1080p60" | "1080p60 HDR"
    | "1440p" | "1440p60" | "1440p60 HDR"
    | "2160p" | "2160p60" | "2160p60 HDR"
    | "4320p" | "4320p60";

type Quality = 'tiny' | 'small' | 'medium' | 'large' | 'hd720' | 'hd1080' | 'hd1440' | 'hd2160' | 'highres';

interface PlayDLFormatData {
    quality: number;
    mimeType?: string;
    format?: string;
    subformat?: string;
    bitrate?: number;
    url?: string;
}

interface AudioFormat {
    url: string;
    itag: number;
    container: string;
    qualityLabel: VideoQualityLabel;
    mimeType: string;
    bitrate: number;
    audioBitrate: number;
    audioCodec?: string;
    codecs: string;
    contentLength: string;
    hasVideo: boolean;
    hasAudio: boolean;
    quality: Quality;
    isLive: boolean;
    isHLS: boolean;
    isDashMPD: boolean;
    lastModified: string;
    approxDurationMs?: string;
    audioQuality?: string;
    audioSampleRate?: string;
    fps?: number;
    height?: number;
    width?: number;
    initRange?: { 
      start?: string;
      end?: string 
    };
    indexRange?: {
       start?: string;
       end?: string 
    };
    colorInfo?: {
        primaries?: string;
        transferCharacteristics?: string;
        matrixCoefficients?: string;
    };
    projectionType?: string;
    averageBitrate?: number;
}

async function downloadWithRetry(videoId: string, format: AudioFormat, outputPath: string, maxRetries = 3, cookies: string): Promise<boolean> {
  let lastError: Error | null = null;
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      if (attempt > 0) {
        await sleep(1000 * (attempt + 1)); // Exponential backoff
      }

      // Try direct download first
      try {
        await downloadWithFetch(format.url, outputPath, cookies);
        return true;
      } catch (fetchError) {
        console.log('Direct download failed, trying ytdl fallback');
      }

      // Fallback to ytdl if direct download fails
      const stream = ytdl(videoId, {
        format: format as unknown as ytdl.videoFormat,
        requestOptions: { headers: { 'User-Agent': getRandomUserAgent(), 'Cookie': cookies } }
      });

      // Add timeout handling
      const timeout = setTimeout(() => {
        stream.destroy(new Error('Download timeout after 5 minutes'));
      }, 5 * 60 * 1000);

      // Create write stream with proper error handling
      const writeStream = fs.createWriteStream(outputPath, { flags: 'w' });
      
      let downloadedBytes = 0;
      const totalBytes = parseInt(format.contentLength) || 0;
      
      stream.on('data', (chunk) => {
        downloadedBytes += chunk.length;
        if (totalBytes) {
          const progress = (downloadedBytes / totalBytes) * 100;
          console.log(`Download progress: ${progress.toFixed(2)}%`);
        }
      });

      // Wait for download to complete
      await new Promise((resolve, reject) => {
        writeStream.on('finish', () => {
          clearTimeout(timeout);
          writeStream.end(() => resolve(true));
        });
        
        writeStream.on('error', (error) => {
          clearTimeout(timeout);
          stream.destroy();
          writeStream.end();
          reject(new Error(`Failed to write audio file: ${error.message}`));
        });
        
        stream.on('error', (error) => {
          clearTimeout(timeout);
          writeStream.end();
          reject(error);
        });

        stream.pipe(writeStream);
      });

      // Verify the file exists and has content
      const stats = await fs.promises.stat(outputPath);
      if (stats.size === 0) {
        throw new Error('Downloaded file is empty');
      }

      return true;
    } catch (error) {
      console.log(`Attempt ${attempt + 1} failed:`, error);
      lastError = error as Error;
      
      // Clean up failed file if it exists
      if (fs.existsSync(outputPath)) {
        await fs.promises.unlink(outputPath).catch(() => {});
      }
      
      // If it's not a 403 error, don't retry
      if (lastError.message.includes('403')) {
        throw error;
      }
    }
  }

  throw lastError || new Error('Download failed after retries');
}

export async function downloadWithPlayDL(videoId: string, outputPath: string, onProgress?: (progress: number) => void): Promise<void> {
  try {
    console.log('Getting video info from play-dl...');
    const video = await play.video_info(videoId);
    console.log('Video info retrieved successfully');

    const audioFormat = video.format.filter(f => {
      const mimeType = f.mimeType || '';
      return mimeType.includes('audio') && !mimeType.includes('video');
  })[0];

    console.log('Selected audio format:', {
      mimeType: audioFormat.mimeType,
      bitrate: audioFormat.bitrate
    });

    console.log('Getting audio stream...');
    const stream = await play.stream_from_info(video);
    console.log('Got audio stream');

    console.log('Starting stream pipe...');
    const fileStream = fs.createWriteStream(outputPath, {
      flags: 'w',
      mode: 0o666 // Read and write for everyone
    });

    return new Promise((resolve, reject) => {
      stream.stream
        .pipe(fileStream)
        .on('finish', () => {
          console.log('Stream finished successfully');
          fileStream.end();
          resolve();
        })
        .on('error', (error) => {
          console.error('Stream error:', error);
          fileStream.end();
          reject(error);
        });

      fileStream.on('error', (error) => {
        console.error('File stream error:', error);
        fileStream.end();
        reject(error);
      });
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error 
      ? error.message 
      : 'Unknown error during play-dl download';
    console.error('Play-dl download error:', errorMessage);
    throw new Error(`Play-dl download failed: ${errorMessage}`);
  }
}

export async function downloadYouTubeAudio(videoId: string, outputPath: string, onProgress?: (progress: number) => void): Promise<string> {
  try {
    // Ensure directories exist
    await ensureDir(path.dirname(outputPath));
    await ensureTempDir();
    
    // Clean up any existing temp files for this video
    await cleanupVideoTempFiles(videoId);

    const tempPath = getTempFilePath(videoId);
    
    console.log('Downloading audio using yt-dlp...');
    onProgress?.(0);
    
    // Use yt-dlp to download audio only in mp3 format with progress
    const command = `yt-dlp -x --audio-format mp3 --audio-quality 0 --newline -o "${tempPath}.%(ext)s" https://www.youtube.com/watch?v=${videoId}`;
    
    const child = spawn(command, [], { shell: true });
    let downloadProgress = 0;

    // Track download progress
    child.stdout.on('data', (data) => {
      const output = data.toString();
      const match = output.match(/\[download\]\s+(\d+\.?\d*)%/);
      if (match) {
        downloadProgress = parseFloat(match[1]);
        onProgress?.(downloadProgress / 2); // First half of progress is download
      }
      console.log('yt-dlp stdout:', output);
    });

    child.stderr.on('data', (data) => {
      console.error('yt-dlp stderr:', data.toString());
    });

    // Wait for process to complete
    await new Promise<void>((resolve, reject) => {
      child.on('close', (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`yt-dlp exited with code ${code}`));
        }
      });
    });

    onProgress?.(50); // Download complete

    // The output file will be tempPath + .mp3
    const downloadedPath = `${tempPath}.mp3`;

    // Copy to final destination
    await fs.promises.copyFile(downloadedPath, outputPath);
    onProgress?.(75); // Copy complete
    
    // Cleanup temp file
    await cleanupTempFiles(downloadedPath);
    onProgress?.(100); // Cleanup complete

    return outputPath;
  } catch (error: unknown) {
    console.error('Error downloading YouTube audio:', error);
    
    // Try fallback method with play-dl
    try {
      console.log('Falling back to play-dl...');
      await downloadWithPlayDL(videoId, outputPath, onProgress);
      return outputPath;
    } catch (playDlError) {
      console.error('play-dl error:', playDlError);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      throw new Error(`Failed to download YouTube audio: ${errorMessage}`);
    }
  }
}

export interface TranscriptionSegment {
  start: number;
  end: number;
  text: string;
  type?: 'code' | 'explanation' | 'other';
}

export async function transcribeAudio(audioPath: string, onProgress?: (progress: number) => void): Promise<string> {
  try {
    onProgress?.(0);
    console.log('Starting Whisper transcription...');

    // Run Python script for transcription
    const process = spawn('python', [
      'scripts/transcribe.py',
      audioPath,
      '--model', 'base'  // Use base model for balance of speed/accuracy
    ]);

    let output = '';
    let error = '';

    process.stdout.on('data', (data) => {
      output += data.toString();
    });

    process.stderr.on('data', (data) => {
      const text = data.toString();
      // Handle progress updates from stderr
      if (text.includes('Loading Whisper model')) {
        onProgress?.(25);
      } else if (text.includes('Starting transcription')) {
        onProgress?.(50);
      }
      
      // Log status messages but collect errors
      if (text.startsWith('Status:')) {
        console.log(text.trim());
      } else if (text.startsWith('Error:')) {
        error += text;
      }
    });

    const exitCode = await new Promise<number>((resolve) => {
      process.on('close', resolve);
    });

    if (exitCode !== 0) {
      throw new Error(`Transcription failed: ${error}`);
    }

    onProgress?.(100);

    try {
      // Parse and validate JSON output
      const result = JSON.parse(output.trim());
      if (!result.segments || !Array.isArray(result.segments)) {
        throw new Error('Invalid transcript format: missing segments array');
      }
      return output.trim();
    } catch (e) {
      console.error('JSON parsing error:', e);
      throw new Error('Invalid JSON output from transcription');
    }
  } catch (error) {
    console.error('Error transcribing audio:', error);
    throw error;
  }
}