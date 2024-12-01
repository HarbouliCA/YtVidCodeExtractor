import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { createVideoEntry } from '@/lib/youtube';
import { processVideo } from '@/lib/video-processor';

// Input validation schema
const submitVideoSchema = z.object({
  url: z.string().url(),
});

export async function POST(req: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    const body = await req.json();
    const result = submitVideoSchema.safeParse(body);

    if (!result.success) {
      return new NextResponse('Invalid input', { status: 400 });
    }

    // Create video entry
    const video = await createVideoEntry(userId, result.data.url);

    // Start processing in background
    processVideo(video.id).catch(console.error);

    return NextResponse.json(video);
  } catch (error) {
    console.error('Error processing video:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}

export async function GET(req: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const videoId = searchParams.get('videoId');

    if (videoId) {
      // Get specific video with snippets and transcript
      const video = await prisma.video.findUnique({
        where: { id: videoId },
        include: {
          codeSnippets: true,
          transcript: true,
        },
      });

      if (!video || video.userId !== userId) {
        return new NextResponse('Video not found', { status: 404 });
      }

      return NextResponse.json(video);
    } else {
      // Get all videos for user
      const videos = await prisma.video.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
      });

      return NextResponse.json(videos);
    }
  } catch (error) {
    console.error('Error fetching videos:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}
