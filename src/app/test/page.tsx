'use client';

import { useState, useEffect } from 'react';
import { Frame } from '@/lib/frame-utils';

interface ProcessingProgress {
  stage: 'downloading' | 'converting' | 'transcribing' | 'analyzing' | 'extracting_frames' | 'ocr_processing' | 'complete' | 'error' | 'unknown';
  progress: number;
  message: string;
  frames?: {
    url: string;
    timestamp: number;
    hasCode: boolean;
    text?: string;
  }[];
  data?: any;
}

export default function TestPage() {
  const [videoUrl, setVideoUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<ProcessingProgress | null>(null);
  const [processingVideoId, setProcessingVideoId] = useState<string | null>(null);

  const extractVideoId = (url: string) => {
    try {
      const regex = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/;
      const match = url.match(regex);
      return match ? match[1] : null;
    } catch (err) {
      console.error('Error extracting video ID:', err);
      return null;
    }
  };

  useEffect(() => {
    let pollInterval: NodeJS.Timeout;
    let attempts = 0;
    const MAX_ATTEMPTS = 180; // 3 minutes at 1-second intervals

    if (processingVideoId) {
      // Poll for progress updates
      pollInterval = setInterval(async () => {
        if (attempts >= MAX_ATTEMPTS) {
          clearInterval(pollInterval);
          setError('Processing timed out after 3 minutes');
          setLoading(false);
          setProcessingVideoId(null);
          return;
        }
        attempts++;

        try {
          const response = await fetch(`/api/process?videoId=${processingVideoId}`);
          if (!response.ok) {
            throw new Error('Failed to fetch progress');
          }
          
          const progressData = await response.json();
          if (progressData.stage === 'error') {
            setError(progressData.message);
            setLoading(false);
            clearInterval(pollInterval);
            setProcessingVideoId(null);
            return;
          }
          
          setProgress(progressData);

          if (progressData.stage === 'complete') {
            setLoading(false);
            clearInterval(pollInterval);
            setProcessingVideoId(null);
            setResult(progressData.data);
            return;
          }

          // If we get an unknown stage, assume something went wrong
          if (progressData.stage === 'unknown') {
            attempts++; // Only increment attempts for unknown status
            if (attempts >= 5) { // Give it 5 tries before erroring
              setError('Processing status unknown');
              setLoading(false);
              clearInterval(pollInterval);
              setProcessingVideoId(null);
            }
            return;
          }
        } catch (err) {
          console.error('Error polling progress:', err);
          setError(err instanceof Error ? err.message : 'Failed to check progress');
          setLoading(false);
          clearInterval(pollInterval);
          setProcessingVideoId(null);
        }
      }, 1000);
    }

    return () => {
      if (pollInterval) {
        clearInterval(pollInterval);
      }
    };
  }, [processingVideoId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResult(null);
    setProgress(null);

    try {
      const videoId = extractVideoId(videoUrl);
      
      if (!videoId) {
        throw new Error('Invalid YouTube URL');
      }

      const response = await fetch('/api/process', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ videoUrl }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to process video');
      }

      setProcessingVideoId(videoId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto p-4 max-w-2xl">
      <h1 className="text-2xl font-bold mb-4">Test Video Processing</h1>
      
      <form onSubmit={handleSubmit} className="mb-8">
        <div className="mb-4">
          <label htmlFor="videoUrl" className="block text-sm font-medium mb-2">
            YouTube Video URL
          </label>
          <input
            type="text"
            id="videoUrl"
            value={videoUrl}
            onChange={(e) => setVideoUrl(e.target.value)}
            placeholder="https://www.youtube.com/watch?v=..."
            className="w-full p-2 border rounded"
          />
        </div>
        <button
          type="submit"
          disabled={loading}
          className={`w-full p-2 text-white rounded ${
            loading
              ? 'bg-gray-400'
              : 'bg-blue-500 hover:bg-blue-600'
          }`}
        >
          {loading ? 'Processing...' : 'Process Video'}
        </button>
      </form>

      {progress && (
        <div className="mb-8">
          <div className="mb-2 flex justify-between text-sm">
            <span>{progress.message}</span>
            <span>{progress.progress}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2.5">
            <div
              className="bg-blue-600 h-2.5 rounded-full transition-all duration-500"
              style={{ width: `${progress.progress}%` }}
            ></div>
          </div>
        </div>
      )}

      {error && (
        <div className="p-4 mb-4 text-red-700 bg-red-100 rounded">
          {error}
        </div>
      )}

      {result && (
        <div className="mt-8">
          <h2 className="text-xl font-bold mb-4">Processing Results</h2>
          <div className="bg-gray-50 p-4 rounded">
            <p className="mb-2">Video ID: {result.videoId}</p>
            <p className="mb-4">Total Frames: {result.frameCount}</p>
            {result.frames && result.frames.length > 0 && (
              <div>
                <h3 className="font-semibold mb-2">Detected Code Frames:</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {result.frames
                    .filter((frame: Frame) => frame.hasCode)
                    .map((frame: Frame, index: number) => (
                      <div key={index} className="border rounded p-4">
                        <img 
                          src={frame.url} 
                          alt={`Code frame at ${frame.timestamp}s`}
                          className="w-full h-auto mb-2"
                        />
                        <p className="text-sm text-gray-600">
                          Timestamp: {frame.timestamp.toFixed(2)}s
                        </p>
                        {frame.text && (
                          <details className="mt-2">
                            <summary className="text-sm text-blue-600 cursor-pointer">
                              Show Detected Text
                            </summary>
                            <pre className="mt-2 text-xs bg-gray-100 p-2 rounded overflow-x-auto">
                              {frame.text}
                            </pre>
                          </details>
                        )}
                      </div>
                    ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
