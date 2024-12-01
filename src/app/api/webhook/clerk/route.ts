import { Webhook } from 'svix';
import { headers } from 'next/headers';
import { WebhookEvent } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';

// Webhook signing secret from Clerk Dashboard
const webhookSecret = process.env.CLERK_WEBHOOK_SECRET;

async function validateRequest(request: Request) {
  const headerPayload = await headers();
  const svix_id = headerPayload.get('svix-id');
  const svix_timestamp = headerPayload.get('svix-timestamp');
  const svix_signature = headerPayload.get('svix-signature');

  // If there are no headers, error out
  if (!svix_id || !svix_timestamp || !svix_signature) {
    return false;
  }

  // Get the body
  const payload = await request.json();
  const body = JSON.stringify(payload);

  // Create a new Svix instance with your secret
  const wh = new Webhook(webhookSecret || '');

  try {
    return await wh.verify(body, {
      'svix-id': svix_id,
      'svix-timestamp': svix_timestamp,
      'svix-signature': svix_signature,
    });
  } catch (err) {
    console.error('Error verifying webhook:', err);
    return false;
  }
}

export async function POST(request: Request) {
  try {
    // Verify the webhook signature
    const payload = await validateRequest(request);
    if (!payload) {
      return new Response('Invalid signature', { status: 401 });
    }

    const event = payload as WebhookEvent;

    // Handle user creation
    if (event.type === 'user.created') {
      const { id, email_addresses, username, first_name, last_name } = event.data;
      const primaryEmail = email_addresses[0]?.email_address;

      if (!primaryEmail) {
        return new Response('No email address found', { status: 400 });
      }

      await prisma.user.create({
        data: {
          clerkId: id,
          email: primaryEmail,
          name: username || [first_name, last_name].filter(Boolean).join(' ') || 'Anonymous',
        },
      });

      return NextResponse.json({ message: 'User created' });
    }

    // Handle user update
    if (event.type === 'user.updated') {
      const { id, email_addresses, username, first_name, last_name } = event.data;
      const primaryEmail = email_addresses[0]?.email_address;

      if (!primaryEmail) {
        return new Response('No email address found', { status: 400 });
      }

      await prisma.user.update({
        where: { clerkId: id },
        data: {
          email: primaryEmail,
          name: username || [first_name, last_name].filter(Boolean).join(' ') || 'Anonymous',
        },
      });

      return NextResponse.json({ message: 'User updated' });
    }

    // Handle user deletion
    if (event.type === 'user.deleted') {
      const { id } = event.data;

      await prisma.user.delete({
        where: { clerkId: id },
      });

      return NextResponse.json({ message: 'User deleted' });
    }

    return NextResponse.json({ message: 'Webhook processed' });
  } catch (error) {
    console.error('Error processing webhook:', error);
    return new Response('Webhook processing failed', { status: 500 });
  }
}

// Only allow POST requests
export async function GET() {
  return new Response('Method not allowed', { status: 405 });
}
