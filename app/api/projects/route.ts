import { NextRequest, NextResponse } from 'next/server';
import { createProject, getFilteredProjects, GetProjectOptions } from '@/server/services/projects';
import { withAuth } from '@/lib/protectedRoute';

export const GET = withAuth(async (req: NextRequest, context: any, session: any) => {
  try {
    const searchParams = req.nextUrl.searchParams;
    const options: GetProjectOptions = {
      page: Number(searchParams.get('page') || 1),
      pageSize: Number(searchParams.get('pageSize') || 12),
      search: searchParams.get('search') || undefined,
      event: searchParams.get('events') || undefined,
    };
    const response = await getFilteredProjects(options);

    return NextResponse.json(response);
  } catch (error: any) {
    console.error('Error GET /api/projects:', error.message);
    const wrappedError = error as Error;
    return NextResponse.json(
      { error: wrappedError.message },
      { status: wrappedError.cause == 'BadRequest' ? 400 : 500 }
    );
  }
});

export const POST = withAuth(async (req: NextRequest, context: any, session: any) => {
  try {
    const body = await req.json();
    
    // Ensure the authenticated user is added as a member
    const members = body.members || [];
    const userIsMember = members.some((m: any) => m.user_id === session.user.id);
    
    if (!userIsMember) {
      // Add the authenticated user as a confirmed member
      members.push({
        user_id: session.user.id,
        role: "Member",
        status: "Confirmed",
      });
    }
    
    const newProject = await createProject({
      ...body,
      members,
    });

    return NextResponse.json(
      { message: 'Project created', project: newProject },
      { status: 201 }
    );
  } catch (error: any) {
    console.error('Error POST /api/projects:', error.message);
    const wrappedError = error as Error;
    return NextResponse.json(
      { error: wrappedError },
      { status: wrappedError.cause == 'ValidationError' ? 400 : 500 }
    );
  }
});
