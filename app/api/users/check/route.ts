import { NextResponse } from 'next/server';
import { getUserByEmail } from '@/server/services/getUser';
import { withAuth } from '@/lib/protectedRoute';
import { Session } from 'next-auth';

export const GET = withAuth(async (request: Request, _context: unknown, session: Session) => {
  const { searchParams } = new URL(request.url);
  const email = searchParams.get('email');
  if (!email) {
    return NextResponse.json({ error: 'Email parameter is required' }, { status: 400 });
  }

  // Only allow a user to check their own email to prevent account enumeration.
  if (email.toLowerCase() !== (session.user.email ?? '').toLowerCase()) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const user = await getUserByEmail(email);
    return NextResponse.json({ exists: !!user });
  } catch (error) {
    console.error("Error checking user by email:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
});
