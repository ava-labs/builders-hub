import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { withAuth } from '@/lib/protectedRoute';
import { userHasConnectedSocials } from '@/lib/ecosystem-careers/viewerAccess';
import {
  AuthorizationError,
  QuotaError,
  createListing,
} from '@/server/services/ecosystemCareers/submitListing';
import { listingBodySchema } from '@/server/services/ecosystemCareers/listingSchema';

function incompleteProfileResponse(hasX: boolean, hasLinkedIn: boolean, verb: 'posting' | 'editing') {
  return NextResponse.json(
    {
      error: 'IncompleteProfile',
      message: `Connect both your X and LinkedIn profiles before ${verb} an ecosystem careers listing.`,
      missing: [...(hasX ? [] : ['x']), ...(hasLinkedIn ? [] : ['linkedin'])],
    },
    { status: 403 },
  );
}

export const POST = withAuth(async (req, _ctx, session) => {
  const userId = session.user.id;
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { hasX, hasLinkedIn } = await userHasConnectedSocials(userId);
  if (!hasX || !hasLinkedIn) return incompleteProfileResponse(hasX, hasLinkedIn, 'posting');

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const parsed = listingBodySchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'ValidationError', issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  try {
    const { id } = await createListing(userId, parsed.data);
    revalidatePath('/ecosystem-careers');
    return NextResponse.json({ id }, { status: 201 });
  } catch (err) {
    if (err instanceof AuthorizationError) {
      return NextResponse.json({ error: err.message }, { status: 403 });
    }
    if (err instanceof QuotaError) {
      return NextResponse.json({ error: err.message }, { status: 422 });
    }
    console.error('POST /api/ecosystem-careers/listings failed:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
});
