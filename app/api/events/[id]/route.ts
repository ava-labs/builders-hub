import { NextRequest, NextResponse } from "next/server";
import { getHackathon, updateHackathon } from "@/server/services/hackathons";
import { HackathonHeader } from "@/types/hackathons";
import { withAuthPermission } from "@/lib/protectedRoute";
import { hasPermission } from "@/lib/auth/roles";

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

export const PUT = withAuthPermission({ resource: "event", action: "write" }, async (req: NextRequest, context: any, session: any) => {
  try {
    const { id } = await context.params;
    const updateData = await req.json();
    const userId = session.user.id;

    const existing = await getHackathon(id);
    if (!existing) {
      return NextResponse.json({ error: "Hackathon not found" }, { status: 404 });
    }
    const attrs: string[] = session.user.custom_attributes ?? [];
    const canManage = hasPermission(attrs, { resource: "event", action: "manage" });
    if (!canManage && existing.created_by !== userId && !existing.cohosts?.includes(session.user.email)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (updateData.hasOwnProperty('is_public') && typeof updateData.is_public === 'boolean' && Object.keys(updateData).length === 1) {
      const updatedHackathon = await updateHackathon(id, { is_public: updateData.is_public }, userId);
      return NextResponse.json(updatedHackathon);
    } else {
      const partialEditedHackathon = updateData as Partial<HackathonHeader>;
      const updatedHackathon = await updateHackathon(partialEditedHackathon.id ?? id, partialEditedHackathon, userId);
      return NextResponse.json(updatedHackathon);
    }
  } catch (error) {
    console.error("Error in PUT /api/events/[id]:", error);
    return NextResponse.json({ error: `Internal Server Error: ${error}` }, { status: 500 });
  }
});

export const PATCH = withAuthPermission({ resource: "event", action: "write" }, async (req: NextRequest, context: any, session: any) => {
  try {
    const { id } = await context.params;
    const updateData = await req.json();
    const userId = session.user.id;

    const existing = await getHackathon(id);
    if (!existing) {
      return NextResponse.json({ error: "Hackathon not found" }, { status: 404 });
    }
    const attrs: string[] = session.user.custom_attributes ?? [];
    const canManage = hasPermission(attrs, { resource: "event", action: "manage" });
    if (!canManage && existing.created_by !== userId && !existing.cohosts?.includes(session.user.email)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (updateData.hasOwnProperty('is_public') && typeof updateData.is_public === 'boolean') {
      const updatedHackathon = await updateHackathon(id, { is_public: updateData.is_public }, userId);
      return NextResponse.json(updatedHackathon);
    } else {
      return NextResponse.json({ error: "Only is_public field can be updated via PATCH" }, { status: 400 });
    }
  } catch (error) {
    console.error("Error in PATCH /api/events/[id]:", error);
    return NextResponse.json({ error: `Internal Server Error: ${error}` }, { status: 500 });
  }
});
