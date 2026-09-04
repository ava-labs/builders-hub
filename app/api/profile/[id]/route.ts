import { NextRequest, NextResponse } from 'next/server';
import { Session } from 'next-auth';
import { getProfile, updateProfile } from '@/server/services/profile';
import { Profile } from '@/types/profile';
import { withAuth, RouteParams } from '@/lib/protectedRoute';
import { UpdateExtendedProfileSchema } from '@/lib/schemas/extended-profile';

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

    // Same allow-list schema as /api/profile/extended — strips unknown keys,
    // bounds bio, validates social handles and image URL.
    const parsed = UpdateExtendedProfileSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request body', details: parsed.error.issues },
        { status: 400 }
      );
    }
    const newProfileData = parsed.data as Partial<Profile>;

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
