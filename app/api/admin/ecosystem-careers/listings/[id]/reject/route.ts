import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { prisma } from '@/prisma/prisma';
import { withAuthPermission, type RouteParams } from '@/lib/protectedRoute';

export const POST = withAuthPermission<RouteParams<{ id: string }>>(
  { resource: 'platform', action: 'admin' },
  async (_req, ctx) => {
    const { id } = await ctx.params;
    const listing = await prisma.jobListing.findUnique({
      where: { id },
      select: { id: true, rejected_at: true },
    });
    if (!listing) {
      return NextResponse.json({ error: 'Listing not found' }, { status: 404 });
    }
    if (listing.rejected_at) {
      return NextResponse.json({ ok: true, alreadyRejected: true });
    }
    await prisma.jobListing.update({
      where: { id },
      data: { rejected_at: new Date(), is_active: false },
    });
    revalidatePath('/ecosystem-careers');
    revalidatePath('/admin/ecosystem-careers');
    return NextResponse.json({ ok: true });
  },
);
