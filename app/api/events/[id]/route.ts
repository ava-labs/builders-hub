import { NextRequest, NextResponse } from "next/server";
import { getHackathon, updateHackathon } from "@/server/services/hackathons";
import { HackathonHeader } from "@/types/hackathons";
import { withAuth } from "@/lib/protectedRoute";
import { getAuthSession } from "@/lib/auth/authSession";

/**
 * Authorize a mutating action on a single event.
 *
 * - `devrel` may manage any hackathon.
 * - Everyone else must be tied to THIS specific event: its creator/last-updater
 *   (`created_by`/`updated_by`) or a co-host (their email in `cohosts`).
 * - Anyone else is forbidden.
 *
 * This mirrors the managed-listing scope in `GET /api/events` and the client-side
 * edit guard (`isSpecialRole || isCohost`), and — crucially — enforces ownership
 * at the server, since `updateHackathon` itself does not. Returns `null` when
 * authorized, otherwise the `NextResponse` error to return.
 */
async function authorizeHackathonManage(
  session: any,
  hackathonId: string
): Promise<NextResponse | null> {
  const attrs: string[] = session?.user?.custom_attributes ?? [];
  if (attrs.includes("devrel")) return null;

  let hackathon: HackathonHeader;
  try {
    hackathon = await getHackathon(hackathonId);
  } catch {
    return NextResponse.json({ error: "Hackathon not found" }, { status: 404 });
  }

  const userId = session?.user?.id;
  const userEmail = session?.user?.email ?? "";
  const isOwner =
    hackathon.created_by === userId ||
    hackathon.updated_by === userId ||
    (Array.isArray(hackathon.cohosts) &&
      !!userEmail &&
      hackathon.cohosts.includes(userEmail));

  if (!isOwner) {
    return NextResponse.json(
      { error: "Forbidden", message: "Access denied." },
      { status: 403 }
    );
  }
  return null;
}

export async function GET(req: NextRequest, context: any) {

  try {
    const { id } = await context.params;

    if (!id) {
      return NextResponse.json({ error: "ID required" }, { status: 400 });
    }

    const hackathon = await getHackathon(id)

    // Private events: only logged-in users may read the record (mirrors the
    // page-level guard in app/(home)/events/[id]/page.tsx). Anonymous callers
    // get a 404 so a private event's details aren't exposed via the raw API.
    if (hackathon?.is_public !== true) {
      const session = await getAuthSession();
      if (!session?.user?.id) {
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

export const PUT = withAuth(async (req: NextRequest, context: any, session: any) => {
  try {
    const { id } = await context.params;
    const updateData = await req.json();
    const userId = session.user.id;

    // The row that will actually be written: a body `id` wins (preserving prior
    // behavior). Authorize against THAT id so the request body cannot redirect
    // the write to an event the caller does not own.
    const targetId =
      typeof updateData?.id === "string" && updateData.id ? updateData.id : id;

    const denied = await authorizeHackathonManage(session, targetId);
    if (denied) return denied;

    if (updateData.hasOwnProperty('is_public') && typeof updateData.is_public === 'boolean' && Object.keys(updateData).length === 1) {
      const updatedHackathon = await updateHackathon(targetId, { is_public: updateData.is_public }, userId);
      return NextResponse.json(updatedHackathon);
    } else {
      const partialEditedHackathon = updateData as Partial<HackathonHeader>;
      const updatedHackathon = await updateHackathon(targetId, partialEditedHackathon, userId);
      return NextResponse.json(updatedHackathon);
    }
  } catch (error) {
    console.error("Error in PUT /api/events/[id]:", error);
    return NextResponse.json({ error: `Internal Server Error: ${error}` }, { status: 500 });
  }
});

export const PATCH = withAuth(async (req: NextRequest, context: any, session: any) => {
  try {
    const { id } = await context.params;
    const updateData = await req.json();
    const userId = session.user.id;

    const denied = await authorizeHackathonManage(session, id);
    if (denied) return denied;

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
