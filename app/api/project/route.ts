import { withAuth } from '@/lib/protectedRoute';
import { prisma } from '@/prisma/prisma';
import { GetProjectByHackathonAndUser } from '@/server/services/projects';
import { createProject } from '@/server/services/submitProject';
import {  NextResponse } from 'next/server';

export const POST = withAuth(async (request,context ,session) => {
  try{
    const body = await request.json();
    const newProject = await createProject({ ...body, submittedBy: session.user.email });
  
    return NextResponse.json({ message: 'project created', project: newProject }, { status: 201 });
  }
  catch (error: any) {
    console.error('Error saving project:', error);
    console.error('Error POST /api/submit-project:', error.message);
    const wrappedError = error as Error;
    return NextResponse.json(
      { error: wrappedError },
      { status: wrappedError.cause == 'ValidationError' ? 400 : 500 }
    );
  }

});



export const GET = withAuth(async (request: Request, context, session) => {
  try {
    const { searchParams } = new URL(request.url);
    const hackaton_id = searchParams.get("hackathon_id") ?? "";
    const user_id = searchParams.get("user_id");
    const invitation_id = searchParams.get("invitation_id") ?? "";

    // Check if user_id matches the authenticated session user
    if (user_id !== null && user_id !== undefined && user_id !== "" && user_id !== session.user.id) {
      return NextResponse.json(
        { error: "Forbidden: You can only access your own projects" },
        { status: 403 }
      );
    }

    // Always use session user ID for security
    const sessionUserId = session.user.id;

    const project = await GetProjectByHackathonAndUser(hackaton_id, sessionUserId, invitation_id);
    return NextResponse.json({ project });
  } catch (error: any) {
    console.error("Error GET /api/project:", error);
    const wrappedError = error as Error;
    return NextResponse.json(
      { error: wrappedError.message },
      { status: wrappedError.cause === "ValidationError" ? 400 : 500 }
    );
  }
});
