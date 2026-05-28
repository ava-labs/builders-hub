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



export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;

    const session = await getAuthSession();
    const userId = session?.user?.id;

    let options: GetHackathonsOptions = {
      page: Number(searchParams.get('page') || 1),
      pageSize: Number(searchParams.get('pageSize') || 10),
      location: searchParams.get('location') || undefined,
      date: searchParams.get('date') || undefined,
      status: searchParams.get('status') as HackathonStatus || undefined,
      search: searchParams.get('search') || undefined,
      event: searchParams.get('event') || undefined,
    };

    const managedOnly = searchParams.get('managed') === 'true';

    if (userId) {
      // Get user from database to validate permissions
      const user = await getUserById(userId);
      if (!user) {
        return NextResponse.json({ error: "User not found" }, { status: 404 });
      }

      const customAttributes = user.custom_attributes || [];
      const isDevrel = customAttributes.includes("devrel");
      const isTeam1Admin = customAttributes.includes("team1-admin");
      const isHackathonCreator = customAttributes.includes("hackathonCreator");

      if (managedOnly) {
        options.include_private = isDevrel || isTeam1Admin || isHackathonCreator;
        if (isDevrel) {
          // Devrel sees every managed hackathon globally.
        } else if (isTeam1Admin) {
          // team1-admin manages hackathons for their own org: scope by their
          // team_id matched against Hackathon.organizers. They also keep
          // visibility into hackathons they personally created or cohost.
          options.created_by = userId;
          options.cohost_email = user.email || undefined;
          options.organizer_team = user.team_id || null;
        } else {
          // Plain hackathonCreator: their own hackathons only.
          options.created_by = userId;
          options.cohost_email = user.email || undefined;
        }
      } else {
        options.include_private = false;
      }
    } else {
      options.include_private = false;
    }

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
  try {
    const body = await req.json();
    const newHackathon = await createHackathon(body);

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
