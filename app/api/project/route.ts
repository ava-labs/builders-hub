import { Session } from 'next-auth';
import { withAuth } from '@/lib/protectedRoute';
import { prisma } from '@/prisma/prisma';
import { GetProjectByHackathonAndUser } from '@/server/services/projects';
import { createProject } from '@/server/services/submitProject';
import { NextResponse } from 'next/server';

async function autoRegisterIfNeeded(session: Session, hackathonId: string) {
  if (!session.user?.email || !hackathonId) return;
  const existing = await prisma.registerForm.findUnique({
    where: { hackathon_id_email: { hackathon_id: hackathonId, email: session.user.email } },
    select: { id: true },
  });
  if (existing) return;

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: { name: true, telegram_account: true, notifications: true, country: true },
  });

  try {
    await prisma.registerForm.create({
      data: {
        hackathon: { connect: { id: hackathonId } },
        user: { connect: { email: session.user.email } },
        name: user?.name ?? session.user.name ?? '',
        city: user?.country ?? '',
        telegram_account: user?.telegram_account ?? '',
        terms_event_conditions: true,
        prohibited_items: false,
        newsletter_subscription: user?.notifications ?? false,
        hackathon_participation: '',
        interests: '',
        languages: '',
        roles: '',
        tools: '',
        web3_proficiency: '',
        github_portfolio: '',
        role: '',
      },
    });
  } catch (err) {
    console.error('[AutoRegister] Failed to auto-register user for hackathon:', err);
  }
}

export const POST = withAuth(async (request, _context: unknown, session: Session) => {
  try{
    const body = await request.json();

    // Auto-register the submitter if they haven't registered for the hackathon yet
    if (body.hackaton_id) {
      await autoRegisterIfNeeded(session, body.hackaton_id);
    }

    const newProject = await createProject({ ...body, submittedBy: session.user.email });

    // Fetch members with user info for the success screen
    const projectWithMembers = await prisma.project.findUnique({
      where: { id: newProject.id },
      select: {
        id: true,
        project_name: true,
        members: {
          select: {
            id: true,
            role: true,
            status: true,
            email: true,
            user: { select: { id: true, name: true, email: true } },
          },
        },
      },
    });

    const members = (projectWithMembers?.members ?? []).map((m) => ({
      id: m.id,
      role: m.role,
      status: m.status,
      name: m.user?.name ?? null,
      email: m.user?.email ?? m.email ?? null,
    }));

    return NextResponse.json(
      { message: 'project created', project: { ...newProject, members } },
      { status: 201 }
    );
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



export const GET = withAuth(async (request: Request, _context: unknown, session: Session) => {
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

    // Return null project if none found - this is valid for new project creation
    return NextResponse.json({ project: project || null });
  } catch (error: any) {
    console.error("Error GET /api/project:", error);
    const wrappedError = error as Error;
    return NextResponse.json(
      { error: wrappedError.message },
      { status: wrappedError.cause === "ValidationError" ? 400 : 500 }
    );
  }
});
