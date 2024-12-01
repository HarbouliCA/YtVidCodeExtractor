import path from 'path';
import fs from 'fs/promises';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export interface Frame {
  url: string;
  timestamp: number;
  hasCode: boolean;
  text?: string;
}

interface PythonFrameData {
  filename: string;
  timestamp: number;
  has_code: boolean;
  text: string;
}

// Function to run Python script for frame extraction and OCR
async function runPythonScript(videoPath: string, outputDir: string): Promise<PythonFrameData[]> {
  const scriptPath = path.join(process.cwd(), 'src', 'lib', 'frame_extractor.py');
  
  try {
    const { stdout, stderr } = await execAsync(`python "${scriptPath}" "${videoPath}" "${outputDir}"`);
    
    if (stderr) {
      console.error('Python script stderr:', stderr);
    }
    
    return JSON.parse(stdout);
  } catch (error) {
    console.error('Error running Python script:', error);
    throw error;
  }
}

export async function extractFrames(videoPath: string, outputDir: string, videoId: string): Promise<Frame[]> {
  try {
    // Ensure output directories exist
    const publicFramesDir = path.join(process.cwd(), 'public', 'frames');
    await fs.mkdir(outputDir, { recursive: true });
    await fs.mkdir(publicFramesDir, { recursive: true });

    console.log('Extracting frames and performing OCR...');
    
    // Extract frames and perform OCR using Python
    const framesData = await runPythonScript(videoPath, outputDir);
    
    // Process frames
    const frames: Frame[] = await Promise.all(
      framesData.map(async (frameData) => {
        const sourcePath = path.join(outputDir, frameData.filename);
        const publicPath = path.join(publicFramesDir, `${videoId}-${frameData.filename}`);
        
        // Copy frame to public directory
        await fs.copyFile(sourcePath, publicPath);
        
        return {
          url: `/frames/${videoId}-${frameData.filename}`,
          timestamp: frameData.timestamp,
          hasCode: frameData.has_code,
          text: frameData.text
        };
      })
    );
    
    console.log('Frame extraction and OCR completed');
    return frames.sort((a, b) => a.timestamp - b.timestamp);
  } catch (error) {
    console.error('Error in extractFrames:', error);
    throw error;
  }
}