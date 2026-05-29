import { NextRequest, NextResponse } from 'next/server';
import {
  createHackathon,
  getFilteredHackathons,
  GetHackathonsOptions,
} from '@/server/services/hackathons';
import { HackathonStatus } from '@/types/hackathons';
import { getUserById } from '@/server/services/getUser';
import { withAuthRole } from '@/lib/protectedRoute';
import { getAuthSession } from '@/lib/auth/authSession';
import { ROLE_GROUPS } from '@/lib/auth/roles';
import { z } from 'zod';

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
  organizers: z.string().optional(),
  content: z.unknown().optional(),
});



const visibilitySchema = z.enum(['all', 'public', 'private']).optional();

export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;

    const rawVisibility = searchParams.get('visibility') ?? undefined;
    const visibilityParse = visibilitySchema.safeParse(rawVisibility);
    if (!visibilityParse.success) {
      return NextResponse.json({ error: 'Invalid visibility value' }, { status: 400 });
    }
    const requestedVisibility = visibilityParse.data;

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

    let isPrivileged = false;

    if (userId) {
      const user = await getUserById(userId);
      if (!user) {
        return NextResponse.json({ error: "User not found" }, { status: 404 });
      }

      const customAttributes = user.custom_attributes || [];
      const isDevrel = customAttributes.includes("devrel");
      const isTeam1Admin = customAttributes.includes("team1-admin");
      const isHackathonCreator = customAttributes.includes("hackathonCreator");
      isPrivileged = isDevrel || isTeam1Admin;

      if (managedOnly) {
        options.include_private = isDevrel || isTeam1Admin || isHackathonCreator;
        if (isDevrel) {
        } else if (isTeam1Admin) {
          options.created_by = userId;
          options.cohost_email = user.email || undefined;
          options.organizer_team = user.team_id || null;
        } else {
          options.created_by = userId;
          options.cohost_email = user.email || undefined;
        }
      } else {
        options.include_private = false;
      }
    } else {
      options.include_private = false;
    }

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

export const POST = withAuthRole(ROLE_GROUPS.hackathonAdmin, async (req: NextRequest, context: any, session: any) => {
  const customAttributes: string[] = session?.user?.custom_attributes || [];
  const roleUsed = customAttributes.includes('devrel')
    ? 'devrel'
    : customAttributes.includes('team1-admin')
    ? 'team1-admin'
    : null;

  try {
    const rawBody = await req.json();

    const parseResult = createHackathonSchema.safeParse(rawBody);
    if (!parseResult.success) {
      return NextResponse.json(
        { error: 'Invalid request body', details: parseResult.error.flatten() },
        { status: 400 }
      );
    }

    const validatedBody = parseResult.data;

    // Org scoping: devrel can organize for any team; team1-admin is forced to
    // their own team. Mirrors canManageHackathon on the edit side.
    let organizers = validatedBody.organizers;
    if (!customAttributes.includes('devrel')) {
      const creator = await getUserById(session.user.id);
      if (!creator?.team_id) {
        return NextResponse.json(
          { error: 'Your account is not assigned to a team.' },
          { status: 400 }
        );
      }
      organizers = creator.team_id;
    }

    console.warn('[AUDIT] POST /api/events — hackathon creation', {
      userId: session.user.id,
      roleUsed,
      title: validatedBody.title,
      timestamp: new Date().toISOString(),
    });

    const newHackathon = await createHackathon({
      ...validatedBody,
      organizers,
      content: validatedBody.content as any,
      created_by: session.user.id,
    });

    return NextResponse.json(
      { message: 'Hackathon created', hackathon: newHackathon },
      { status: 201 }
    );
  } catch (error: any) {
    console.error('Error POST /api/events:', error?.message, error?.stack);
    const isValidation = error?.cause === 'ValidationError';
    return NextResponse.json(
      {
        error: error?.message ?? 'Internal Server Error',
        details: isValidation ? error?.details : undefined,
        code: error?.code,
      },
      { status: isValidation ? 400 : 500 }
    );
  }
});
