import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { prisma } from '@/prisma/prisma';
import { withAuthRole, type RouteParams } from '@/lib/protectedRoute';

// Devrel-only quick-edit endpoint for any listing source. The standard
// /api/ecosystem-careers/listings/[id] PUT route is intentionally limited
// to community-sourced rows posted by the team that owns the project;
// this endpoint bypasses that restriction so devrel can fix typos and
// missing logos on Getro/web3.career ingested rows without leaving the
// public board.
//
// Only the two priority fields are accepted (title + company_logo) — wider
// edits go through the existing rich edit form. Empty string on logo
// clears it (sets NULL).
const patchSchema = z.object({
  title: z.string().min(2).max(160).optional(),
  company_logo: z.string().url().or(z.literal('')).nullable().optional(),
});

export const PATCH = withAuthRole<RouteParams<{ id: string }>>(
  'devrel',
  async (req, ctx) => {
    const { id } = await ctx.params;

    let raw: unknown;
    try {
      raw = await req.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const parsed = patchSchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'ValidationError', issues: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const existing = await prisma.jobListing.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!existing) {
      return NextResponse.json({ error: 'Listing not found' }, { status: 404 });
    }

    const data: { title?: string; company_logo?: string | null } = {};
    if (parsed.data.title !== undefined) data.title = parsed.data.title.trim();
    if (parsed.data.company_logo !== undefined) {
      // Empty string clears the value; non-empty stores as-is.
      const v = parsed.data.company_logo;
      data.company_logo = !v ? null : v;
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ ok: true, noChanges: true });
    }

    await prisma.jobListing.update({ where: { id }, data });
    revalidatePath('/ecosystem-careers');
    revalidatePath(`/ecosystem-careers/${id}`);
    return NextResponse.json({ ok: true });
  },
);
