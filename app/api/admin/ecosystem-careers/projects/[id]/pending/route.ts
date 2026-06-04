import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { prisma } from '@/prisma/prisma';
import { withAuthRole, type RouteParams } from '@/lib/protectedRoute';

export const DELETE = withAuthRole<RouteParams<{ id: string }>>(
  'devrel',
  async (_req, ctx) => {
    const { id } = await ctx.params;
    const project = await prisma.project.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }
    const result = await prisma.jobListing.deleteMany({
      where: { project_id: id, source: 'community', is_active: false },
    });
    revalidatePath('/ecosystem-careers');
    revalidatePath('/admin/ecosystem-careers');
    return NextResponse.json({ ok: true, deleted: result.count });
  },
);
