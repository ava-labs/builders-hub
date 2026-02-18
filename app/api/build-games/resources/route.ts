import { NextResponse } from 'next/server';
import { getAuthSession } from '@/lib/auth/authSession';
import { getHackathon } from '@/server/services/hackathons';
import { prisma } from '@/prisma/prisma';

const HACKATHON_ID = "249d2911-7931-4aa0-a696-37d8370b79f9";

export async function GET() {
  try {
    const session = await getAuthSession();

    // Return empty for unauthenticated users
    if (!session?.user?.email) {
      return NextResponse.json({ hasAccess: false, resources: [] });
    }

    // Check if user has applied
    const application = await prisma.buildGamesApplication.findUnique({
      where: { email: session.user.email },
    });

    if (!application) {
      return NextResponse.json({ hasAccess: false, resources: [] });
    }

    // Get hackathon resources
    const hackathon = await getHackathon(HACKATHON_ID);

    if (!hackathon || !hackathon.content?.resources) {
      return NextResponse.json({ hasAccess: true, resources: [] });
    }

    return NextResponse.json({
      hasAccess: true,
      resources: hackathon.content.resources,
    });
  } catch (error) {
    console.error('Error fetching resources:', error);
    return NextResponse.json({ hasAccess: false, resources: [] });
  }
}
