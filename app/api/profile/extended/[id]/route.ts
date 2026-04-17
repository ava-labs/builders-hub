import { NextRequest, NextResponse } from 'next/server';
import { Session } from 'next-auth';
import {
  getExtendedProfile,
  updateExtendedProfile,
  ProfileValidationError
} from '@/server/services/profile/profile.service';
import {
  UpdateExtendedProfileSchema,
  type UpdateExtendedProfileInput,
} from '@/lib/schemas/extended-profile';
import { withAuth, RouteParams } from '@/lib/protectedRoute';

/**
 * Parses and validates the request body against the extended profile update
 * schema. Returns the validated payload, or a ready-to-send 400 NextResponse
 * when the body is malformed or fails validation.
 */
async function parseProfileUpdateBody(
  req: NextRequest,
): Promise<UpdateExtendedProfileInput | NextResponse> {
  let rawBody: unknown;
  try {
    rawBody = await req.json();
  } catch {
    return NextResponse.json(
      { error: 'Invalid JSON body.' },
      { status: 400 },
    );
  }

  const parsed = UpdateExtendedProfileSchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: 'Invalid request body.',
        details: parsed.error.flatten(),
      },
      { status: 400 },
    );
  }

  return parsed.data;
}

/**
 * GET /api/profile/extended/[id]
 * Gets the extended profile of a user
 */
export const GET = withAuth<RouteParams<{ id: string }>>(async (
  req: NextRequest,
  { params },
  session: Session
) => {
  try {
    const id = (await params).id;
    
    if (!id) {
      return NextResponse.json(
        { error: 'User ID is required.' },
        { status: 400 }
      );
    }

    // Verify that the user can only access their own profile
    // Comment this validation if you want to allow viewing other users' profiles
    const isOwnProfile = session.user.id === id;
    if (!isOwnProfile) {
      return NextResponse.json(
        { error: 'Forbidden: You can only access your own profile.' },
        { status: 403 }
      );
    }

    const profile = await getExtendedProfile(id);

    if (!profile) {
      return NextResponse.json(
        { error: 'Profile not found.' },
        { status: 404 }
      );
    }

    return NextResponse.json(profile);
  } catch (error) {
    console.error('Error in GET /api/profile/extended/[id]:', error);
    return NextResponse.json(
      { 
        error: 'Internal Server Error', 
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
});

/**
 * PUT /api/profile/extended/[id]
 * update extended profile
 */
export const PUT = withAuth<RouteParams<{ id: string }>>(async (
  req: NextRequest,
  { params },
  session: Session
) => {
  try {
    const id = (await params).id;
    
    if (!id) {
      return NextResponse.json(
        { error: 'User ID is required.' },
        { status: 400 }
      );
    }

    if (session.user.id !== id) {
      return NextResponse.json(
        { error: 'Forbidden: You can only update your own profile.' },
        { status: 403 }
      );
    }

    const parsedBody = await parseProfileUpdateBody(req);
    if (parsedBody instanceof NextResponse) return parsedBody;

    const updatedProfile = await updateExtendedProfile(id, parsedBody);

    return NextResponse.json(updatedProfile);
  } catch (error) {
    console.error('Error in PUT /api/profile/extended/[id]:', error);

    if (error instanceof ProfileValidationError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.statusCode }
      );
    }

    return NextResponse.json(
      {
        error: 'Internal Server Error',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
});

/**
 * PATCH /api/profile/extended/[id]
 * Partial update of extended profile (useful for settings updates)
 */
export const PATCH = withAuth<RouteParams<{ id: string }>>(async (
  req: NextRequest,
  { params },
  session: Session
) => {
  try {
    const id = (await params).id;

    if (!id) {
      return NextResponse.json(
        { error: 'User ID is required.' },
        { status: 400 }
      );
    }

    if (session.user.id !== id) {
      return NextResponse.json(
        { error: 'Forbidden: You can only update your own profile.' },
        { status: 403 }
      );
    }

    const parsedBody = await parseProfileUpdateBody(req);
    if (parsedBody instanceof NextResponse) return parsedBody;

    const updatedProfile = await updateExtendedProfile(id, parsedBody);

    return NextResponse.json(updatedProfile);
  } catch (error) {
    console.error('Error in PATCH /api/profile/extended/[id]:', error);

    if (error instanceof ProfileValidationError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.statusCode }
      );
    }

    console.error('Error in PATCH /api/profile/extended/[id]:', (error as Error).message);
    return NextResponse.json(
      {
        error: 'Internal Server Error',
        details: (error as Error).message
      },
      { status: 500 }
    );
  }
});
