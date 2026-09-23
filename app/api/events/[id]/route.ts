import { NextRequest, NextResponse } from "next/server";
import { getHackathon, updateHackathon } from "@/server/services/hackathons";
import { HackathonHeader } from "@/types/hackathons";
import { withAuth } from "@/lib/protectedRoute";
import { getAuthSession } from "@/lib/auth/authSession";
import { canEditEvent, canViewPrivateEvent } from "@/lib/auth/permissions";

export async function GET(req: NextRequest, context: any) {

  try {
    const { id } = await context.params;

    if (!id) {
      return NextResponse.json({ error: "ID required" }, { status: 400 });
    }

    const hackathon = await getHackathon(id)

    // Private events follow the same visibility rule as the listing endpoint
    // (app/api/events/route.ts): devrel and team1-admin see any private event,
    // and a hackathon's own creator or cohost sees theirs. 
    if (hackathon?.is_public !== true) {
      if (!(await canViewPrivateEvent(await getAuthSession(), hackathon))) {
        return NextResponse.json({ error: "Hackathon not found" }, { status: 404 });
      }
    }

    return NextResponse.json(hackathon);
  } catch (error) {
    console.error("Error in GET /api/events/[id]:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export const PUT = withAuth(async (req: NextRequest, context: any, session: any) => {
  try {
    const { id } = await context.params;
    if (!(await canEditEvent(session, id))) {
      return NextResponse.json({ error: 'Forbidden', message: 'Access denied.' }, { status: 403 });
    }
    const updateData = await req.json();
    const userId = session.user.id;

    if (updateData.hasOwnProperty('is_public') && typeof updateData.is_public === 'boolean' && Object.keys(updateData).length === 1) {
      const updatedHackathon = await updateHackathon(id, { is_public: updateData.is_public }, userId);
      return NextResponse.json(updatedHackathon);
    } else {
      const partialEditedHackathon = updateData as Partial<HackathonHeader>;
      // Always use the URL path id — never let a body-supplied id redirect the
      // update to a different hackathon row or rename the primary key.
      const updatedHackathon = await updateHackathon(id, partialEditedHackathon, userId);
      return NextResponse.json(updatedHackathon);
    }
  } catch (error) {
    const wrappedError = error as Error;
    if (wrappedError.cause === 'ValidationError') {
      const details = (wrappedError as any).details as Array<{ field: string; message: string }> | undefined;
      console.error(
        "Error in PUT /api/events/[id]: Validation failed",
        details?.map((d) => `${d.field}: ${d.message}`)
      );
      // The detail list is logged above; it is not echoed back. It enumerates
      // internal field names, which is a map for probing the update payload.
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }
    console.error("Error in PUT /api/events/[id]:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
});

export const PATCH = withAuth(async (req: NextRequest, context: any, session: any) => {
  try {
    const { id } = await context.params;
    if (!(await canEditEvent(session, id))) {
      return NextResponse.json({ error: 'Forbidden', message: 'Access denied.' }, { status: 403 });
    }
    const updateData = await req.json();
    const userId = session.user.id;

    if (updateData.hasOwnProperty('is_public') && typeof updateData.is_public === 'boolean') {
      const updatedHackathon = await updateHackathon(id, { is_public: updateData.is_public }, userId);
      return NextResponse.json(updatedHackathon);
    } else {
      return NextResponse.json({ error: "Only is_public field can be updated via PATCH" }, { status: 400 });
    }
  } catch (error) {
    console.error("Error in PATCH /api/events/[id]:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
});
