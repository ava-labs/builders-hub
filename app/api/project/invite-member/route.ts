import { withAuth } from '@/lib/protectedRoute';
import { generateInvitation } from '@/server/services/inviteProjectMember';

import {  NextResponse } from 'next/server';

export const POST = withAuth(async (request,context ,session) => {
  try{
    const body = await request.json();
    console.log("body",body)
    const newProject = await generateInvitation(body.hackathonId, body.id, session.user.name);
  
    return NextResponse.json({ message: 'project created', project: newProject }, { status: 201 });
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
