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
    // 3. Confirmed project member of a Build Games project
    const [application, registration, project] = await Promise.all([
      prisma.buildGamesApplication.findUnique({
        where: { email: session.user.email },
        select: { id: true, first_name: true, project_name: true, created_at: true },
      }),
      prisma.registerForm.findFirst({
        where: { hackathon_id: BG_HACKATHON_ID, email: session.user.email },
        select: { id: true, name: true, created_at: true },
      }),
      prisma.project.findFirst({
        where: {
          hackaton_id: BG_HACKATHON_ID,
          members: { some: { email: session.user.email } },
        },
        select: { id: true, project_name: true, created_at: true },
      }),
    ]);

    const isParticipant = !!(application || registration || project);

    if (!isParticipant) {
      return NextResponse.json({ isParticipant: false });
    }

    // Use the best available project name: application > project > registration name
    const projectName =
      application?.project_name ??
      project?.project_name ??
      "Build Games 2026";

    const createdAt = (
      application?.created_at ??
      registration?.created_at ??
      project?.created_at
    )?.toISOString() ?? new Date().toISOString();

    return NextResponse.json({
      isParticipant: true,
      participant: { projectName, createdAt },
    });
  } catch (error) {
    console.error('Error checking application status:', error);
    return NextResponse.json({ isParticipant: false });
  }
}
