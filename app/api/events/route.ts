// withApi: not applicable — uses withAuthRole() and getAuthSession() for auth
import { NextRequest, NextResponse } from 'next/server';
import { createHackathon, getFilteredHackathons, GetHackathonsOptions } from '@/server/services/hackathons';
import { HackathonStatus } from '@/types/hackathons';
import { getUserById } from '@/server/services/getUser';
import { withAuthRole } from '@/lib/protectedRoute';
import { getAuthSession } from '@/lib/auth/authSession';

export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;

    const session = await getAuthSession();
    const userId = session?.user?.id;

    let options: GetHackathonsOptions = {
      page: Number(searchParams.get('page') || 1),
      pageSize: Math.min(Number(searchParams.get('pageSize') || 10), 100),
      location: searchParams.get('location') || undefined,
      date: searchParams.get('date') || undefined,
      status: (searchParams.get('status') as HackathonStatus) || undefined,
      search: searchParams.get('search') || undefined,
      event: searchParams.get('event') || undefined,
    };

    if (userId) {
      // Get user from database to validate permissions
      const user = await getUserById(userId);
      if (!user) {
        return NextResponse.json({ error: 'User not found' }, { status: 404 });
      }

      // Check user's custom_attributes for permissions
      const customAttributes = user.custom_attributes || [];
      const isDevrel = customAttributes.includes('devrel');
      const isTeam1Admin = customAttributes.includes('team1-admin');
      const isHackathonCreator = customAttributes.includes('hackathonCreator');

      // If user is devrel, show all hackathons; otherwise filter by user ID
      const createdByFilter = isDevrel ? undefined : userId;

      options.created_by = createdByFilter || undefined;
      // Only narrow by cohost email for non-devrel users; devrel should see all
      if (!isDevrel) {
        options.cohost_email = user.email || undefined;
      }
      options.include_private = isDevrel || isTeam1Admin || isHackathonCreator; // These roles can see private hackathons

      // logging removed
    } else {
      options.include_private = false;
      // logging removed
    }

    const response = await getFilteredHackathons(options);

    return NextResponse.json(response);
  } catch (error: any) {
    console.error('Error GET /api/events:', error.message);
    const wrappedError = error as Error;
    return NextResponse.json(
      { error: wrappedError.message },
      { status: wrappedError.cause == 'BadRequest' ? 400 : 500 },
    );
  }
}

export const POST = withAuthRole('devrel', async (req: NextRequest, _context: any, _session: any) => {
  try {
    const body = await req.json();
    const newHackathon = await createHackathon(body);

    return NextResponse.json({ message: 'Hackathon created', hackathon: newHackathon }, { status: 201 });
  } catch (error: any) {
    console.error('Error POST /api/events:', error.message);
    const wrappedError = error as Error;
    return NextResponse.json({ error: wrappedError }, { status: wrappedError.cause == 'ValidationError' ? 400 : 500 });
  }
});
