import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { AuthOptions } from '@/lib/auth/authOptions';
import { prisma } from '@/prisma/prisma';
import { syncUserDataToHubSpot } from '@/server/services/hubspotUserData';

/**
 * API endpoint to create a new user after they accept terms.
 * This is called when a user verifies their email via OTP but hasn't been
 * created in the database yet (to avoid creating accounts for users who
 * don't accept terms).
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(AuthOptions);

    if (!session?.user?.email) {
      return NextResponse.json(
        { error: 'Unauthorized: No valid session' },
        { status: 401 }
      );
    }

    const email = session.user.email;

    // Check if user already exists (shouldn't happen, but safety check)
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      // User already exists, just return their data
      return NextResponse.json({
        id: existingUser.id,
        email: existingUser.email,
        alreadyExists: true,
      });
    }

    // Get the terms acceptance data from the request body
    const body = await req.json();
    const { notifications = false } = body;

    // Create the new user
    const newUser = await prisma.user.create({
      data: {
        email,
        notification_email: email,
        name: '',
        image: '',
        authentication_mode: 'credentials',
        last_login: new Date(),
        notifications: notifications,
      },
    });

    // Sync user data to HubSpot (after terms acceptance)
    if (newUser.email) {
      try {
        await syncUserDataToHubSpot({
          email: newUser.email,
          name: newUser.name || undefined,
          notifications: newUser.notifications ?? undefined,
          gdpr: true, // User accepted terms and conditions
        });
      } catch (error) {
        console.error('[HubSpot UserData] Failed to sync new user:', error);
        // Don't block user creation if HubSpot sync fails
      }
    }

    return NextResponse.json({
      id: newUser.id,
      email: newUser.email,
      created: true,
    });
  } catch (error) {
    console.error('Error creating user after terms:', error);
    return NextResponse.json(
      { error: 'Failed to create user' },
      { status: 500 }
    );
  }
}
