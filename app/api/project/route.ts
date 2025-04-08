import { withAuth } from '@/lib/protectedRoute';
import { prisma } from '@/prisma/prisma';
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



export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const hackaton_id = searchParams.get("hackathon_id");
  const user_id = searchParams.get("user_id");

  if (!hackaton_id || !user_id) {
    return NextResponse.json(
      { error: "Faltan hackaton_id o user_id" },
      { status: 400 }
    );
  }
  const project = await prisma.project.findFirst({
    where: {
      hackaton_id,
      members: {
        some: { user_id:user_id,status: "Confirmed" },
      },
    },
  });

  if (!project) {
    return NextResponse.json({ error: "Proyecto no encontrado" }, { status: 404 });
  }

  return NextResponse.json({ project });
}