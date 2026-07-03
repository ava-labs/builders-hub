import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { withAuthRole, type RouteParams } from '@/lib/protectedRoute';
import { approveProjectForCareers } from '@/server/services/ecosystemCareers/submitListing';

export const POST = withAuthRole<RouteParams<{ id: string }>>(
  'devrel',
  async (_req, ctx) => {
    const { id } = await ctx.params;
    try {
      const result = await approveProjectForCareers(id);
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
