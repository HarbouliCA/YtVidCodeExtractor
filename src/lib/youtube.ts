import ytdl from 'ytdl-core';
import { VideoStatus } from '@prisma/client';
import { prisma } from './db';

export interface VideoMetadata {
  videoId: string;
  title: string;
  description: string;
  thumbnailUrl: string;
  duration: number;
}

export async function extractYouTubeId(url: string): Promise<string> {
  try {
    const videoId = ytdl.getVideoID(url);
    return videoId;
  } catch (error) {
    throw new Error('Invalid YouTube URL');
  }
}

export async function getVideoMetadata(url: string): Promise<VideoMetadata> {
  try {
    const videoId = await extractYouTubeId(url);
    const info = await ytdl.getInfo(url);
    
    return {
      videoId,
      title: info.videoDetails.title,
      description: info.videoDetails.description || '',
      thumbnailUrl: info.videoDetails.thumbnails[0]?.url || '',
      duration: parseInt(info.videoDetails.lengthSeconds),
    };
  } catch (error) {
    throw new Error('Failed to fetch video metadata');
  }
}

export async function createVideoEntry(
  userId: string,
  url: string
): Promise<{ id: string; status: VideoStatus }> {
  try {
    const metadata = await getVideoMetadata(url);
    
    const video = await prisma.video.create({
      data: {
        youtubeId: metadata.videoId,
        title: metadata.title,
        description: metadata.description,
        thumbnailUrl: metadata.thumbnailUrl,
        duration: metadata.duration,
        status: 'PENDING',
        userId,
      },
      select: {
        id: true,
        status: true,
      },
    });
    
    return video;
  } catch (error) {
    throw new Error('Failed to create video entry');
  }
}
