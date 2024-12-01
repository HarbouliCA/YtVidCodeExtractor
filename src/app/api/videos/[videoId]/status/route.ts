import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/db';

export async function GET(
  req: Request,
  { params }: { params: { videoId: string } }
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    const video = await prisma.video.findUnique({
      where: { id: params.videoId },
      select: {
        id: true,
        status: true,
        userId: true,
      },
    });

    if (!video || video.userId !== userId) {
      return new NextResponse('Video not found', { status: 404 });
    }

    return NextResponse.json({ status: video.status });
  } catch (error) {
    console.error('Error fetching video status:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}
