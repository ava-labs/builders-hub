import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { prisma } from '@/prisma/prisma';
import { withAuthPermission, type RouteParams } from '@/lib/protectedRoute';

// Per-listing approval for ingested external/getro rows. Community listings
// go through the project-level approve route; ingested listings get their
// own button per row because we can't bulk-approve an unknown company.
export const POST = withAuthPermission<RouteParams<{ id: string }>>(
  { resource: 'platform', action: 'admin' },
  async (_req, ctx) => {
    const { id } = await ctx.params;
    const listing = await prisma.jobListing.findUnique({
      where: { id },
      select: { id: true, source: true, is_active: true },
    });
    if (!listing) {
      return NextResponse.json({ error: 'Listing not found' }, { status: 404 });
    }
    if (listing.source === 'community') {
      return NextResponse.json(
        { error: 'Use the project approval flow for community listings' },
        { status: 400 },
      );
    }
    if (listing.is_active) {
      return NextResponse.json({ ok: true, alreadyActive: true });
    }
    await prisma.jobListing.update({
      where: { id },
      data: { is_active: true, last_seen_at: new Date() },
    });
    revalidatePath('/ecosystem-careers');
    revalidatePath('/admin/ecosystem-careers');
    return NextResponse.json({ ok: true });
  },
);
