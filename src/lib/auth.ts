import { auth } from '@clerk/nextjs';
import { prisma } from './prisma';

export async function getCurrentUser() {
  try {
    const { userId } = auth();

    if (!userId) {
      return null;
    }

    const user = await prisma.user.findUnique({
      where: { clerkId: userId },
    });

    return user;
  } catch (error) {
    console.error('Error getting current user:', error);
    return null;
  }
}

export async function requireAuth() {
  const user = await getCurrentUser();
  
  if (!user) {
    throw new Error('Unauthorized');
  }
  
  return user;
}
