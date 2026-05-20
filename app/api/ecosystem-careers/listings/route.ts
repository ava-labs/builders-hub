import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { withAuth } from '@/lib/protectedRoute';
import { prisma } from '@/prisma/prisma';
import {
  AuthorizationError,
  ProjectRejectedError,
  QuotaError,
  createListing,
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
          'Connect both your X and LinkedIn profiles before posting an ecosystem careers listing.',
        missing: [...(hasX ? [] : ['x']), ...(hasLi ? [] : ['linkedin'])],
      },
      { status: 403 },
    );
  }
  return null;
}

export const POST = withAuth(async (req, _ctx, session) => {
  const userId = session.user.id;
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const gate = await requireConnectedSocials(userId);
  if (gate) return gate;

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
    if (err instanceof ProjectRejectedError) {
      return NextResponse.json(
        { error: 'ProjectRejected', message: err.message },
        { status: 422 },
      );
    }
    console.error('POST /api/ecosystem-careers/listings failed:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
});
