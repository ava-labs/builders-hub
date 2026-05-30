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

    const isParticipant = !!(application || registration || projects.length > 0);

    if (!isParticipant) {
      return NextResponse.json({ isParticipant: false });
    }

    // Fetch FormData for all projects in parallel
    const projectsWithResults = await Promise.all(
      projects.map(async (p) => {
        const formData = await prisma.formData.findFirst({
          where: { project_id: p.id },
          select: { form_data: true },
        });
        const buildGames = (formData?.form_data as Record<string, any>)?.build_games;
        const stage1Result: string | null = buildGames?.stage1_result ?? null;
        const stage2Result: string | null = (buildGames?.stages as Record<string, string> | undefined)?.['2'] ?? null;
        const isConfirmed = p.members.some((m) => m.status === "Confirmed");
        return { projectName: p.project_name, stage1Result, stage2Result, isConfirmed, createdAt: p.created_at };
      })
    );

    // Selection logic:
    // 1. Prefer accepted projects; among those prefer confirmed membership.
    // 2. If multiple confirmed+accepted exist, show all of them.
    // 3. If no accepted projects, show the confirmed one.
    // 4. If only one project total, show it regardless.
    let selectedProjects = projectsWithResults;

    if (projectsWithResults.length > 1) {
      const accepted = projectsWithResults.filter((p) => p.stage1Result === "accepted");
      if (accepted.length > 0) {
        const confirmedAccepted = accepted.filter((p) => p.isConfirmed);
        selectedProjects = confirmedAccepted.length > 0 ? confirmedAccepted : accepted;
      } else {
        const confirmed = projectsWithResults.filter((p) => p.isConfirmed);
        selectedProjects = confirmed.length > 0 ? [confirmed[0]] : [projectsWithResults[0]];
      }
    }

    const stageResults = selectedProjects
      .filter((p) => p.stage1Result !== null || p.stage2Result !== null)
      .map((p) => ({ projectName: p.projectName, stage1Result: p.stage1Result, stage2Result: p.stage2Result }));

    const firstProject = selectedProjects[0];
    const projectName = firstProject?.projectName ?? application?.project_name ?? "Build Games 2026";

    const createdAt = (
      application?.created_at ??
      registration?.created_at ??
      firstProject?.createdAt
    )?.toISOString() ?? new Date().toISOString();

    return NextResponse.json({
      isParticipant: true,
      participant: { projectName, createdAt },
      stageResults,
    });
  } catch (error) {
    console.error('Error checking application status:', error);
    return NextResponse.json({ isParticipant: false });
  }
}
