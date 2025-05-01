import { NextResponse } from 'next/server';
import { getUserByEmail } from '@/server/services/getUser';
import { withAuth } from '@/lib/protectedRoute';


export const GET = withAuth(async (request: Request) => {
    const { searchParams } = new URL(request.url);
    const email = searchParams.get('email');
  if (!email) {
    return NextResponse.json({ error: 'Email parameter is required' }, { status: 400 });
  }

  try {
    const user = await getUserByEmail(email);
    return NextResponse.json({ exists: !!user });
  } catch (error) {
    console.error("Error checking user by email:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
});
