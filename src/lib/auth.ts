import { currentUser, clerkClient } from '@clerk/nextjs/server';
import { prisma } from './prisma';

export async function getCurrentUser() {
  try {
    const user = await currentUser();

    if (!user) {
      return null;
    }

    const dbUser = await prisma.user.findUnique({
      where: { clerkId: user.id },
    });

    return dbUser;
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
