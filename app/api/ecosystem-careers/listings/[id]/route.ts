import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { withAuth, type RouteParams } from '@/lib/protectedRoute';
import { prisma } from '@/prisma/prisma';
import {
  AuthorizationError,
  deactivateListing,
  updateListing,
} from '@/server/services/ecosystemCareers/submitListing';

const REMOTE_TYPES = ['remote', 'onsite', 'hybrid'] as const;
const EMPLOYMENT_TYPES = ['full_time', 'contract', 'part_time'] as const;

const listingBodySchema = z.object({
  project_id: z.string().uuid(),
  title: z.string().min(2).max(160),
  short_description: z.string().max(280).optional().nullable(),
  description: z.string().min(20),
  location: z.string().max(120).optional().nullable(),
  remote_type: z.enum(REMOTE_TYPES).optional().nullable(),
  employment_type: z.enum(EMPLOYMENT_TYPES).optional().nullable(),
  seniority: z.string().max(40).optional().nullable(),
  tags: z.array(z.string().min(1).max(40)).max(6).optional(),
  apply_url: z.string().url(),
});

async function requireConnectedSocials(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { x_account: true, linkedin_account: true },
  });
  const hasX = !!user?.x_account?.trim();
  const hasLi = !!user?.linkedin_account?.trim();
  if (!hasX || !hasLi) {
    return NextResponse.json(
      {
        error: 'IncompleteProfile',
        message:
          'Connect both your X and LinkedIn profiles before editing an ecosystem careers listing.',
        missing: [...(hasX ? [] : ['x']), ...(hasLi ? [] : ['linkedin'])],
      },
      { status: 403 },
    );
  }
  return null;
}

export const PUT = withAuth<RouteParams<{ id: string }>>(async (req, ctx, session) => {
  const userId = session.user.id;
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const gate = await requireConnectedSocials(userId);
  if (gate) return gate;

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
