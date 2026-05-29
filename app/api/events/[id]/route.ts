import { NextRequest, NextResponse } from "next/server";
import { getHackathon, updateHackathon, canManageHackathon } from "@/server/services/hackathons";
import { HackathonHeader } from "@/types/hackathons";
import { withAuthRole } from "@/lib/protectedRoute";
import { ROLE_GROUPS } from "@/lib/auth/roles";
import { getAuthSession } from "@/lib/auth/authSession";
import { getUserById } from "@/server/services/getUser";

export async function GET(req: NextRequest, context: any) {

  try {
    const { id } = await context.params;

    if (!id) {
      return NextResponse.json({ error: "ID required" }, { status: 400 });
    }

    const hackathon = await getHackathon(id)

    // Private/draft events are only readable by managers (devrel or the
    // organizing team's admin), the creator, or a cohost. Others get 404.
    if (hackathon.is_public !== true) {
      const session = await getAuthSession();
      const actingUser = session?.user?.id ? await getUserById(session.user.id) : null;
      const isOwner = !!session?.user?.id && hackathon.created_by === session.user.id;
      const isCohost = !!session?.user?.email && (hackathon.cohosts ?? []).includes(session.user.email);
      if (!canManageHackathon(actingUser, hackathon) && !isOwner && !isCohost) {
        return NextResponse.json({ error: "Hackathon not found" }, { status: 404 });
      }
    }

    return NextResponse.json(hackathon);
  } catch (error) {
    console.error("Error in GET /api/events/[id]:");
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 500 }
    );
  }
}

export const PUT = withAuthRole(ROLE_GROUPS.hackathonAdmin, async (req: NextRequest, context: any, session: any) => {
  try {
    const { id } = await context.params;
    const updateData = await req.json();
    const userId = session.user.id;

    if (updateData.hasOwnProperty('is_public') && typeof updateData.is_public === 'boolean' && Object.keys(updateData).length === 1) {
      const updatedHackathon = await updateHackathon(id, { is_public: updateData.is_public }, userId);
      return NextResponse.json(updatedHackathon);
    } else {
      const partialEditedHackathon = updateData as Partial<HackathonHeader>;
      // Use the URL id only, never a caller-supplied body id.
      const updatedHackathon = await updateHackathon(id, partialEditedHackathon, userId);
      return NextResponse.json(updatedHackathon);
    }
  } catch (error: any) {
    console.error("Error in PUT /api/events/[id]:", error?.message, error?.stack);
    const isValidation = error?.cause === 'ValidationError';
    const isForbidden = error?.cause === 'Forbidden';
    return NextResponse.json(
      {
        error: error?.message ?? 'Internal Server Error',
        details: isValidation ? error?.details : undefined,
        code: error?.code,
      },
      { status: isForbidden ? 403 : isValidation ? 400 : 500 }
    );
  }
});

export const PATCH = withAuthRole(ROLE_GROUPS.hackathonAdmin, async (req: NextRequest, context: any, session: any) => {
  try {
    const { id } = await context.params;
    const updateData = await req.json();
    const userId = session.user.id;

    if (updateData.hasOwnProperty('is_public') && typeof updateData.is_public === 'boolean') {
      const updatedHackathon = await updateHackathon(id, { is_public: updateData.is_public }, userId);
      return NextResponse.json(updatedHackathon);
    } else {
      return NextResponse.json({ error: "Only is_public field can be updated via PATCH" }, { status: 400 });
    }
  } catch (error: any) {
    console.error("Error in PATCH /api/events/[id]:", error?.message, error?.stack);
    const isValidation = error?.cause === 'ValidationError';
    const isForbidden = error?.cause === 'Forbidden';
    return NextResponse.json(
      {
        error: error?.message ?? 'Internal Server Error',
        details: isValidation ? error?.details : undefined,
        code: error?.code,
      },
      { status: isForbidden ? 403 : isValidation ? 400 : 500 }
    );
  }
});
