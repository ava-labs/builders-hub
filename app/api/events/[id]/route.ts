import { NextRequest, NextResponse } from "next/server";
import { getHackathon, updateHackathon } from "@/server/services/hackathons";
import { HackathonHeader } from "@/types/hackathons";
import { withAuthRole } from "@/lib/protectedRoute";
import { ROLE_GROUPS } from "@/lib/auth/roles";

export async function GET(req: NextRequest, context: any) {

  try {
    const { id } = await context.params;

    if (!id) {
      return NextResponse.json({ error: "ID required" }, { status: 400 });
    }

    const hackathon = await getHackathon(id)
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
      // SECURITY (IDOR): the update target MUST be the URL `id` param only.
      // Never trust a caller-supplied body `id` — otherwise PUT /api/events/a
      // with body { id: "b" } would update a different row.
      const updatedHackathon = await updateHackathon(id, partialEditedHackathon, userId);
      return NextResponse.json(updatedHackathon);
    }
  } catch (error: any) {
    console.error("Error in PUT /api/events/[id]:", error?.message, error?.stack);
    const isValidation = error?.cause === 'ValidationError';
    return NextResponse.json(
      {
        error: error?.message ?? 'Internal Server Error',
        details: isValidation ? error?.details : undefined,
        code: error?.code,
      },
      { status: isValidation ? 400 : 500 }
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
    return NextResponse.json(
      {
        error: error?.message ?? 'Internal Server Error',
        details: isValidation ? error?.details : undefined,
        code: error?.code,
      },
      { status: isValidation ? 400 : 500 }
    );
  }
});
