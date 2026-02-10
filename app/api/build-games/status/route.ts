import { NextResponse } from 'next/server';
import { getAuthSession } from '@/lib/auth/authSession';
import { prisma } from '@/prisma/prisma';

export async function GET() {
  try {
    const session = await getAuthSession();

    // Return hasApplied: false for unauthenticated users
    if (!session?.user?.email) {
      return NextResponse.json({ hasApplied: false });
    }

    const application = await prisma.buildGamesApplication.findUnique({
      where: { email: session.user.email },
      select: {
        id: true,
        first_name: true,
        project_name: true,
        created_at: true,
      },
    });

    if (!application) {
      return NextResponse.json({ hasApplied: false });
    }

    return NextResponse.json({
      hasApplied: true,
      application: {
        id: application.id,
        firstName: application.first_name,
        projectName: application.project_name,
        createdAt: application.created_at.toISOString(),
      },
    });
  } catch (error) {
    console.error('Error checking application status:', error);
    // Return hasApplied: false on error
    return NextResponse.json({ hasApplied: false });
  }
}
