import { withAuth } from '@/lib/protectedRoute';
import { prisma } from '@/prisma/prisma';
import { GetProjectByHackathonAndUser } from '@/server/services/projects';
import { createProject } from '@/server/services/submitProject';
import {  NextResponse } from 'next/server';

export const POST = withAuth(async (request,context ,session) => {
  try{
    const body = await request.json();
    console.log("body",body)
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
    const user_id = searchParams.get("user_id") ?? "";

    const project = await GetProjectByHackathonAndUser(hackaton_id, user_id);
    return NextResponse.json({ project });
  } catch (error: any) {
    console.error("Error GET /api/your-endpoint:", error);
    const wrappedError = error as Error;
    return NextResponse.json(
      { error: wrappedError.message },
      { status: wrappedError.cause === "ValidationError" ? 400 : 500 }
    );
  }
});
