import { NextResponse } from 'next/server';
import { getAuthSession } from '@/lib/auth/authSession';
import { prisma } from '@/prisma/prisma';

const BG_HACKATHON_ID = "249d2911-7931-4aa0-a696-37d8370b79f9";

export async function GET() {
  try {
    const session = await getAuthSession();

    if (!session?.user?.email) {
      return NextResponse.json({ isParticipant: false });
    }

    // Check all three participation paths in parallel:
    // 1. BuildGames application form
    // 2. RegisterForm for the Build Games hackathon
    // 3. Project member (non-Removed) of a Build Games project
    const [application, registration, projects] = await Promise.all([
      prisma.buildGamesApplication.findUnique({
        where: { email: session.user.email },
        select: { id: true, first_name: true, project_name: true, created_at: true },
      }),
      prisma.registerForm.findFirst({
        where: { hackathon_id: BG_HACKATHON_ID, email: session.user.email },
        select: { id: true, name: true, created_at: true },
      }),
      prisma.project.findMany({
        where: {
          hackaton_id: BG_HACKATHON_ID,
          members: { some: { email: session.user.email, status: { not: "Removed" } } },
        },
        select: {
          id: true,
          project_name: true,
          created_at: true,
          members: {
            where: { email: session.user.email, status: { not: "Removed" } },
            select: { status: true },
          },
        },
      }),
    ]);

    // If the user is on multiple projects, prefer the one where they are Confirmed.
    // If only on one project, use it regardless of status.
    const project =
      projects.length === 1
        ? projects[0]
        : projects.find((p) => p.members.some((m) => m.status === "Confirmed")) ??
          projects[0] ??
          null;

    const isParticipant = !!(application || registration || project);

    if (!isParticipant) {
      return NextResponse.json({ isParticipant: false });
    }

    // Fetch stage results from FormData for the resolved project
    let stage1Result: string | null = null;
    if (project?.id) {
      const formData = await prisma.formData.findFirst({
        where: { project_id: project.id },
        select: { form_data: true },
      });
      const buildGames = (formData?.form_data as Record<string, any>)?.build_games;
      stage1Result = buildGames?.stage1_result ?? null;
    }

    // Use the best available project name: application > project > registration name
    const projectName =
      project?.project_name ??
      application?.project_name ??
      "Build Games 2026";

    const createdAt = (
      application?.created_at ??
      registration?.created_at ??
      project?.created_at
    )?.toISOString() ?? new Date().toISOString();

    return NextResponse.json({
      isParticipant: true,
      participant: { projectName, createdAt },
      stage1Result,
    });
  } catch (error) {
    console.error('Error checking application status:', error);
    return NextResponse.json({ isParticipant: false });
  }
}
