'use client';

import { useState, useEffect } from 'react';

interface ProcessingProgress {
  stage: 'downloading' | 'converting' | 'transcribing' | 'analyzing' | 'complete' | 'error';
  progress: number;
  message: string;
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
            setResult(progressData.result);
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
        <div className="mt-8 p-4 bg-white rounded-lg shadow">
          <h2 className="text-xl font-semibold mb-4">Processing Results</h2>
          <div className="space-y-4">
            {result.success ? (
              <>
                <div className="p-4 bg-green-100 text-green-700 rounded">
                  Successfully processed video!
                </div>
                <div className="mt-4">
                  <h3 className="font-medium mb-2">Transcription:</h3>
                  <div className="p-4 bg-gray-50 rounded whitespace-pre-wrap font-mono text-sm">
                    {result.transcription}
                  </div>
                </div>
              </>
            ) : (
              <div className="p-4 bg-red-100 text-red-700 rounded">
                {result.error || 'Failed to process video'}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
