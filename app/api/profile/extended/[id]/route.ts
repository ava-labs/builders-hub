import { NextRequest, NextResponse } from 'next/server';
import { Session } from 'next-auth';
import {
  getExtendedProfile,
  updateExtendedProfile,
  ProfileValidationError
} from '@/server/services/profile/profile.service';
import { UpdateExtendedProfileSchema } from '@/lib/schemas/extended-profile';
import { withAuth, RouteParams } from '@/lib/protectedRoute';

/**
 * Parses and validates the request body against the extended profile update
 * schema. Returns either the validated payload or a ready-to-send 400 response.
 */
async function parseProfileUpdateBody(req: NextRequest) {
  let rawBody: unknown;
  try {
    rawBody = await req.json();
  } catch {
    return {
      error: NextResponse.json(
        { error: 'Invalid JSON body.' },
        { status: 400 },
      ),
    };
  }

  const parsed = UpdateExtendedProfileSchema.safeParse(rawBody);
  if (!parsed.success) {
    return {
      error: NextResponse.json(
        {
          error: 'Invalid request body.',
          details: parsed.error.flatten(),
        },
        { status: 400 },
      ),
    };
  }

  return { data: parsed.data };
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
    if ('error' in parsedBody) return parsedBody.error;

    const updatedProfile = await updateExtendedProfile(id, parsedBody.data);

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
    if ('error' in parsedBody) return parsedBody.error;

    const updatedProfile = await updateExtendedProfile(id, parsedBody.data);

    return NextResponse.json(updatedProfile);
  } catch (error) {
    console.error('Error in PATCH /api/profile/extended/[id]:', error);

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
