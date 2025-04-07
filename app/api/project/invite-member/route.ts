import { withAuth } from '@/lib/protectedRoute';
import { generateInvitation } from '@/server/services/inviteProjectMember';

import {  NextResponse } from 'next/server';

export const POST = withAuth(async (request,context ,session) => {
  try{
    const body = await request.json();
    console.log("body",body)
     await generateInvitation(body.hackathon_id, body.user_id, session.user.name,body.emails);
    return NextResponse.json({ message: 'invitation sent' }, { status: 201 });
  }
  catch (error: any) {
    console.error('Error inviting members:', error);
    console.error('Error POST /api/submit-project:', error.message);
    const wrappedError = error as Error;
    return NextResponse.json(
      { error: wrappedError },
      { status: wrappedError.cause == 'ValidationError' ? 400 : 500 }
    );
  }

});

export const GET = withAuth(async (request,context ,session) => {
  const { searchParams } = new URL(request.url);
    const email = searchParams.get('invitationId');
  if (!email) {
    return NextResponse.json({ error: 'invitationId parameter is required' }, { status: 400 });
  }

  try {
    // const user = await getUserByEmail(email);
    return NextResponse.json({ exists: !!user });
  } catch (error) {
    console.error("Error checking user by email:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

});
