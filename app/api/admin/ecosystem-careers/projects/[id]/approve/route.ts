import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { withAuthRole, type RouteParams } from '@/lib/protectedRoute';
import { approveProjectForCareers } from '@/server/services/ecosystemCareers/submitListing';

export const POST = withAuthRole<RouteParams<{ id: string }>>(
  'devrel',
  async (_req, ctx, session) => {
    const userId = session.user.id;
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await ctx.params;
    try {
      const result = await approveProjectForCareers(id, userId);
      revalidatePath('/ecosystem-careers');
      revalidatePath('/admin/ecosystem-careers');
      return NextResponse.json({ ok: true, activated: result.activated });
    } catch (err) {
      console.error('approve project for careers failed:', err);
      const msg = err instanceof Error ? err.message : 'Internal error';
      return NextResponse.json({ error: msg }, { status: 500 });
    }
  },
);
