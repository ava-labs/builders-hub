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

      // Determine visibility using the new permission model
      const attrs = user.custom_attributes || [];
      const canManageHackathons = hasPermission(attrs, { resource: "hackathon", action: "manage" });
      const canWriteHackathons  = hasPermission(attrs, { resource: "hackathon", action: "write" });
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
      console.log('API GET /events (no userId):', { options });
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

export const POST = withAuthPermission({ resource: "hackathon", action: "write" }, async (req: NextRequest, context: any, session: any) => {
  try {
    const body = await req.json();
    const newHackathon = await createHackathon(body);

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
