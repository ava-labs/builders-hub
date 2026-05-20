import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { withAuthRole, type RouteParams } from '@/lib/protectedRoute';
import { rejectProjectForCareers } from '@/server/services/ecosystemCareers/submitListing';

const bodySchema = z.object({ reason: z.string().max(500).optional() });

export const POST = withAuthRole<RouteParams<{ id: string }>>(
  'devrel',
  async (req, ctx, session) => {
    const userId = session.user.id;
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await ctx.params;
    let parsed: { reason?: string } = {};
    try {
      const raw = await req.json();
      const r = bodySchema.safeParse(raw);
      if (r.success) parsed = r.data;
    } catch {
      // empty body is OK — reason is optional
    }

    try {
      await rejectProjectForCareers(id, userId, parsed.reason ?? null);
      revalidatePath('/ecosystem-careers');
      revalidatePath('/admin/ecosystem-careers');
      return NextResponse.json({ ok: true });
    } catch (err) {
      console.error('reject project for careers failed:', err);
      const msg = err instanceof Error ? err.message : 'Internal error';
      return NextResponse.json({ error: msg }, { status: 500 });
    }
  },
);
