import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { createProject, getFilteredProjects, GetProjectOptions } from '@/server/services/projects';

const prisma = new PrismaClient();

export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const options: GetProjectOptions = {
      page: Number(searchParams.get('page') || 1),
      pageSize: Number(searchParams.get('pageSize') || 12),
      search: searchParams.get('search') || undefined,
      events: searchParams.get('events') || undefined,
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
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const newProject = await createProject(body);

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
}
