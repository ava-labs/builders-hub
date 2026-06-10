import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { prisma } from '@/prisma/prisma';
import { withAuthPermission, type RouteParams } from '@/lib/protectedRoute';

export const DELETE = withAuthPermission<RouteParams<{ id: string }>>(
  { resource: 'platform', action: 'admin' },
  async (_req, ctx) => {
    const { id } = await ctx.params;
    const listing = await prisma.jobListing.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!listing) {
      return NextResponse.json({ error: 'Listing not found' }, { status: 404 });
    }
    await prisma.jobListing.delete({ where: { id } });
    revalidatePath('/ecosystem-careers');
    revalidatePath('/admin/ecosystem-careers');
    return NextResponse.json({ ok: true });
  },
);
