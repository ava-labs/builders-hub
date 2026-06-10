import { NextRequest, NextResponse } from 'next/server';
import {
  createHackathon,
  getFilteredHackathons,
  GetHackathonsOptions,
} from '@/server/services/hackathons';
import { HackathonStatus } from '@/types/hackathons';
import { getUserById } from '@/server/services/getUser';
import { withAuthPermission } from '@/lib/protectedRoute';
import { getAuthSession } from '@/lib/auth/authSession';
import { hasPermission } from '@/lib/auth/roles';


import { z } from 'zod';

/**
 * SECURITY: Role assignment audit trail.
 *
 * The custom_attributes values used to gate hackathon creation are assigned
 * server-side by privileged endpoints only:
 *
 * - `devrel`            – assigned via the internal admin panel at
 *                         POST /api/admin/users/[id]/roles, which itself
 *                         requires `withAuthRole('devrel', ...)` (devrel-only).
 *
 * - `team1-admin`       – assigned by the same /api/admin/users/[id]/roles
 *                         endpoint; only a devrel user can grant this attribute.
 *                         It scopes a partner organisation's admin access.
 *
 * - `hackathonCreator`  – assigned via POST /api/admin/users/[id]/roles;
 *                         requires the caller to hold the `devrel` attribute.
 *                         It is intended for trusted external event organisers
 *                         who need the ability to create hackathons without
 *                         full devrel access.
 *
 * None of these attributes can be self-assigned by a regular user.
 */

/**
 * Zod schema for the POST /api/events request body.
 *
 * SECURITY: Unknown keys are stripped (`.strip()` is the Zod default for
 * objects) so that callers cannot inject unexpected fields into the Prisma
 * create call.  Only explicitly allow-listed fields are forwarded to
 * `createHackathon`.
 */
const createHackathonSchema = z.object({
  title: z.string().min(1).max(255),
  description: z.string().min(1),
  start_date: z.string().min(1),
  end_date: z.string().min(1),
  location: z.string().min(1),
  total_prizes: z.number().nonnegative().optional(),
  participants: z.number().nonnegative().optional(),
  tags: z.array(z.string()).min(1),
  timezone: z.string().optional(),
  cohosts: z.array(z.string().email()).optional(),
  icon: z.string().optional(),
  banner: z.string().optional(),
  small_banner: z.string().optional(),
  top_most: z.boolean().optional(),
  event: z.string().optional(),
  new_layout: z.boolean().optional(),
  is_public: z.boolean().optional(),
  google_calendar_id: z.string().nullable().optional(),
  // `content` is a freeform JSON blob — accept unknown shape but strip at the
  // top level via the enclosing object schema.
  content: z.unknown().optional(),
});



const visibilitySchema = z.enum(['all', 'public', 'private']).optional();

export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;

    // SECURITY: Parse and validate the visibility param BEFORE acting on it.
    // An unauthorized caller must never be able to use this param to bypass
    // the is_public filter — validation and role check happen first.
    const rawVisibility = searchParams.get('visibility') ?? undefined;
    const visibilityParse = visibilitySchema.safeParse(rawVisibility);
    if (!visibilityParse.success) {
      return NextResponse.json({ error: 'Invalid visibility value' }, { status: 400 });
    }
    const requestedVisibility = visibilityParse.data;

    // Build options WITHOUT visibility — it will be set after the role check.
    let options: GetHackathonsOptions = {
      page: Number(searchParams.get('page') || 1),
      pageSize: Number(searchParams.get('pageSize') || 10),
      location: searchParams.get('location') || undefined,
      date: searchParams.get('date') || undefined,
      status: searchParams.get('status') as HackathonStatus || undefined,
      search: searchParams.get('search') || undefined,
      event: searchParams.get('event') || undefined,
      sort: searchParams.get('sort') || undefined,
    };

    const session = await getAuthSession();
    const userId = session?.user?.id;
    const managedOnly = searchParams.get('managed') === 'true';

    let isPrivileged = false; // devrel or team1-admin — the only roles allowed to see private hackathons

    if (userId) {
      const user = await getUserById(userId);
      if (!user) {
        return NextResponse.json({ error: "User not found" }, { status: 404 });
      }

      // Determine visibility using the new permission model
      const attrs = user.custom_attributes || [];
      const canManageHackathons = hasPermission(attrs, { resource: "event", action: "manage" });
      const canWriteHackathons  = hasPermission(attrs, { resource: "event", action: "write" });
      const hasHackathonAccess  = canManageHackathons || canWriteHackathons;

      if (managedOnly) {
        options.include_private = hasHackathonAccess;
        if (!canManageHackathons) {
          // Non-admin editors only see their own events
          options.created_by = userId;
          options.cohost_email = user.email || undefined;
        }
      } else {
        options.include_private = false;
      }

      console.log('API GET /events:', { userId, canManageHackathons, canWriteHackathons, managedOnly, options });
    } else {
      options.include_private = false;
    }

    // SECURITY: Only devrel/team1-admin may request visibility=private or visibility=all.
    // All other callers receive only public hackathons regardless of the param.
    if (requestedVisibility === 'private' || requestedVisibility === 'all') {
      if (!isPrivileged) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
    }
    options.visibility = requestedVisibility;

    console.warn('API GET /events:', { userId, isPrivileged, managedOnly });

    const response = await getFilteredHackathons(options);

    return NextResponse.json(response);
  } catch (error: any) {
    console.error('Error GET /api/events:', error.message);
    const wrappedError = error as Error;
    return NextResponse.json(
      { error: wrappedError.message },
      { status: wrappedError.cause == 'BadRequest' ? 400 : 500 }
    );
  }
}

export const POST = withAuthPermission({ resource: "event", action: "write" }, async (req: NextRequest, context: any, session: any) => {
  try {
    const rawBody = await req.json();

    // SECURITY: Validate and strip unknown fields via Zod before forwarding to
    // the service layer.  This prevents mass-assignment / schema injection.
    const parseResult = createHackathonSchema.safeParse(rawBody);
    if (!parseResult.success) {
      return NextResponse.json(
        { error: 'Invalid request body', details: parseResult.error.flatten() },
        { status: 400 }
      );
    }

    const validatedBody = parseResult.data;

    // SECURITY: Audit log — record who is creating the hackathon and which
    // role was used to authorise the action.  Do NOT log the full body as it
    // may contain PII.
    console.warn('[AUDIT] POST /api/events — hackathon creation', {
      userId: session.user.id,
      title: validatedBody.title,
      timestamp: new Date().toISOString(),
    });

    const newHackathon = await createHackathon({
      ...validatedBody,
      // `content` is a freeform JSON column; cast to satisfy the Partial<HackathonHeader> type.
      content: validatedBody.content as any,
      created_by: session.user.id,
    });

    return NextResponse.json(
      { message: 'Hackathon created', hackathon: newHackathon },
      { status: 201 }
    );
  } catch (error: any) {
    console.error('Error POST /api/events:', error.message);
    const wrappedError = error as Error;
    return NextResponse.json(
      { error: wrappedError },
      { status: wrappedError.cause == 'ValidationError' ? 400 : 500 }
    );
  }
});
