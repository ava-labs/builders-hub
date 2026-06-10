import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { prisma } from '@/prisma/prisma';
import { withAuthPermission, type RouteParams } from '@/lib/protectedRoute';

const patchSchema = z.object({
  title: z.string().min(2).max(160).optional(),
  company_logo: z.string().url().or(z.literal('')).nullable().optional(),
});

export const PATCH = withAuthPermission<RouteParams<{ id: string }>>(
  { resource: 'platform', action: 'admin' },
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
      select: { id: true, source: true, project_id: true },
    });
    if (!existing) {
      return NextResponse.json({ error: 'Listing not found' }, { status: 404 });
    }

    const listingData: { title?: string; company_logo?: string | null } = {};
    if (parsed.data.title !== undefined) listingData.title = parsed.data.title.trim();

    let projectLogo: string | null | undefined;
    if (parsed.data.company_logo !== undefined) {
      const v = parsed.data.company_logo;
      const normalized = !v ? null : v;
      if (existing.source === 'community' && existing.project_id) {
        projectLogo = normalized;
      } else {
        listingData.company_logo = normalized;
      }
    }

    const hasListingUpdate = Object.keys(listingData).length > 0;
    const hasProjectUpdate = projectLogo !== undefined && existing.project_id;
    if (!hasListingUpdate && !hasProjectUpdate) {
      return NextResponse.json({ ok: true, noChanges: true });
    }

    const ops: Promise<unknown>[] = [];
    if (hasListingUpdate) {
      ops.push(prisma.jobListing.update({ where: { id }, data: listingData }));
    }
    if (hasProjectUpdate) {
      ops.push(
        prisma.project.update({
          where: { id: existing.project_id! },
          data: { logo_url: projectLogo ?? '' },
        }),
      );
    }
    await Promise.all(ops);

    revalidatePath('/ecosystem-careers');
    revalidatePath(`/ecosystem-careers/${id}`);
    return NextResponse.json({ ok: true });
  },
);
