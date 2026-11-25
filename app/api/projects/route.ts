import { NextRequest, NextResponse } from 'next/server';
import { createProjectWithMembers, getFilteredProjects, GetProjectOptions } from '@/server/services/projects';
import { withAuth } from '@/lib/protectedRoute';
import { MemberStatus } from "@/types/project";
import { z } from 'zod';

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

const link = z.record(z.string(), z.unknown());
const createProjectSchema = z.object({
  project_name: z.string().max(200).optional(),
  short_description: z.string().optional(),
  full_description: z.string().optional(),
  cover_url: z.string().optional(),
  logo_url: z.string().optional(),
  demo_link: z.string().optional(),
  demo_video_link: z.string().optional(),
  github_repository: z.string().optional(),
  tech_stack: z.string().optional(),
  screenshots: z.array(z.string()).optional(),
  tracks: z.array(z.string()).optional(),
  tags: z.array(z.string()).optional(),
  website: link.optional(),
  socials: link.optional(),
  hackaton_id: z.string().nullable().optional(),
  origin: z.string().optional(),
  members: z.array(z.object({ user_id: z.string().min(1) })).max(50).optional(),
});

export const POST = withAuth(async (req: NextRequest, context: any, session: any) => {
  try {
    const parsed = createProjectSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }
    const body = parsed.data;

    // The caller is the one confirmed member. Each other user the caller names
    // is an invitee: the body cannot set a role or a status for another user.
    const invitees = new Set((body.members ?? []).map((m) => m.user_id));
    invitees.delete(session.user.id);
    const members = [
      { user_id: session.user.id, role: 'Member', status: MemberStatus.CONFIRMED },
      ...[...invitees].map((user_id) => ({ user_id, role: 'Member', status: MemberStatus.PENDING })),
    ];

    const newProject = await createProjectWithMembers({
      ...body,
      hackaton_id: body.hackaton_id ?? undefined,
      members,
    } as unknown as Parameters<typeof createProjectWithMembers>[0]);

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
