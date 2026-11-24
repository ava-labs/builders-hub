import { NextRequest, NextResponse } from 'next/server';
import { Session } from 'next-auth';
import { getProfile, updateProfile } from '@/server/services/profile';
import { withAuth, RouteParams } from '@/lib/protectedRoute';
import { z } from 'zod';
import { readJsonBody } from '@/lib/api/json-body';

// The fields updateProfile in server/services/profile.ts writes. The name check stays in the service.
const updateProfileSchema = z.object({
  name: z.string().optional(),
  bio: z.string().optional(),
  notification_email: z.string().optional(),
  notifications: z.boolean().nullable().optional(),
  consent_sharing: z.boolean().nullable().optional(),
  profile_privacy: z.string().optional(),
  additional_social_accounts: z.array(z.string()).optional(),
  telegram_account: z.string().optional(),
});

export const GET = withAuth<RouteParams<{ id: string }>>(async (
  req: NextRequest,
  { params },
  session: Session
) => {
  try {
    const id = (await params).id;
    if (!id) {
      return NextResponse.json(
        { error: 'Id parameter is required.' },
        { status: 400 }
      );
    }

    // Check if user is trying to access their own profile
    const isOwnProfile = session.user.id === id;
    if (!isOwnProfile) {
      return NextResponse.json(
        { error: 'Forbidden' },
        { status: 403 }
      );
    }
    const profile = await getProfile(id);
    return NextResponse.json(profile);
  } catch (error) {
    console.error('Error in GET /api/profile/[id]', error);
    return NextResponse.json(
      { error: `: ${error}` },
      { status: 400 }
    );
  }
});

export const PUT = withAuth<RouteParams<{ id: string }>>(async (
  req: NextRequest,
  { params },
  session: Session
) => {
  try {
    const id = (await params).id;
    if (!id) {
      return NextResponse.json(
        { error: 'Id parameter is required.' },
        { status: 400 }
      );
    }

    // Use strict equality check
    if (session.user.id !== id) {
      return NextResponse.json(
        { error: 'Forbidden: You can only update your own profile.' },
        { status: 403 }
      );
    }

    const newProfileData = await readJsonBody(req, updateProfileSchema);
    if (!newProfileData) {
      return NextResponse.json(
        { error: 'Invalid request body' },
        { status: 400 }
      );
    }

    const updatedProfile = await updateProfile(
      id,
      newProfileData
    );

    return NextResponse.json(updatedProfile);
  } catch (error) {
    console.error('Error in PUT /api/profile/[id]:', error);
    return NextResponse.json(
      { error: `Internal Server Error: ${error}` },
      { status: 500 }
    );
  }
});
