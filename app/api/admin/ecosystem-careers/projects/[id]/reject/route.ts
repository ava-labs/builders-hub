import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { prisma } from '@/prisma/prisma';
import { withAuthPermission, type RouteParams } from '@/lib/protectedRoute';

export const POST = withAuthPermission<RouteParams<{ id: string }>>(
  { resource: 'platform', action: 'admin' },
  async (_req, ctx) => {
    const { id } = await ctx.params;
    const project = await prisma.project.findUnique({
      where: { id },
      select: { id: true, careers_rejected_at: true },
    });
    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }
    if (project.careers_rejected_at) {
      return NextResponse.json({ ok: true, alreadyRejected: true });
    }
    const now = new Date();
    const [, listingResult] = await prisma.$transaction([
      prisma.project.update({
        where: { id },
        data: { careers_rejected_at: now },
      }),
      prisma.jobListing.updateMany({
        where: { project_id: id, source: 'community', is_active: false, rejected_at: null },
        data: { rejected_at: now },
      }),
    ]);
    revalidatePath('/ecosystem-careers');
    revalidatePath('/admin/ecosystem-careers');
    return NextResponse.json({ ok: true, rejectedListings: listingResult.count });
  },
);
