import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { withAuth, type RouteParams } from '@/lib/protectedRoute';
import { userHasConnectedSocials } from '@/lib/ecosystem-careers/viewerAccess';
import {
  AuthorizationError,
  deactivateListing,
  updateListing,
} from '@/server/services/ecosystemCareers/submitListing';
import { listingBodySchema } from '@/server/services/ecosystemCareers/listingSchema';

function incompleteProfileResponse(hasX: boolean, hasLinkedIn: boolean) {
  return NextResponse.json(
    {
      error: 'IncompleteProfile',
      message: 'Connect both your X and LinkedIn profiles before editing an ecosystem careers listing.',
      missing: [...(hasX ? [] : ['x']), ...(hasLinkedIn ? [] : ['linkedin'])],
    },
    { status: 403 },
  );
}

export const PUT = withAuth<RouteParams<{ id: string }>>(async (req, ctx, session) => {
  const userId = session.user.id;
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { hasX, hasLinkedIn } = await userHasConnectedSocials(userId);
  if (!hasX || !hasLinkedIn) return incompleteProfileResponse(hasX, hasLinkedIn);

  const { id } = await ctx.params;
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
    await updateListing(userId, id, parsed.data);
    revalidatePath('/ecosystem-careers');
    revalidatePath(`/ecosystem-careers/${id}`);
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof AuthorizationError) {
      return NextResponse.json({ error: err.message }, { status: 403 });
    }
    console.error('PUT /api/ecosystem-careers/listings/[id] failed:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
});

export const DELETE = withAuth<RouteParams<{ id: string }>>(async (_req, ctx, session) => {
  const userId = session.user.id;
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await ctx.params;
  try {
    await deactivateListing(userId, id);
    revalidatePath('/ecosystem-careers');
    revalidatePath(`/ecosystem-careers/${id}`);
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof AuthorizationError) {
      return NextResponse.json({ error: err.message }, { status: 403 });
    }
    console.error('DELETE /api/ecosystem-careers/listings/[id] failed:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
});
