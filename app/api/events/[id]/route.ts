import { NextRequest, NextResponse } from "next/server";
import { getHackathon, updateHackathon } from "@/server/services/hackathons";
import { HackathonHeader } from "@/types/hackathons";
import { withAuth } from "@/lib/protectedRoute";
import { getAuthSession } from "@/lib/auth/authSession";
import { canEditEvent, canViewPrivateEvent } from "@/lib/auth/permissions";

/**
 * What a signed-in participant needs from a private event, and nothing else.
 *
 * An allowlist rather than a blacklist: signup is open, so "logged in" is a
 * weak gate on an unpublished event, and a blacklist ships every field nobody
 * thought to name. Adding a field to the model must not silently widen this.
 *
 * The two flows that read this endpoint are the registration form (team size)
 * and project submission (submission deadline), plus the event heading they
 * both render.
 */
const PARTICIPANT_FIELDS = [
  "id",
  "title",
  "description",
  "location",
  "start_date",
  "end_date",
  "timezone",
  "banner",
  "icon",
  "small_banner",
  "tags",
  "event",
  "custom_link",
  "is_public",
] as const;

/** `content` is a free-form Json blob, so it is passed key by key too. */
const PARTICIPANT_CONTENT_FIELDS = [
  "team_size_min",
  "team_size_max",
  "submission_deadline",
] as const;

function participantView(hackathon: unknown) {
  if (!hackathon || typeof hackathon !== "object") return hackathon;
  const row = hackathon as Record<string, unknown>;
  const view: Record<string, unknown> = {};
  for (const field of PARTICIPANT_FIELDS) {
    if (field in row) view[field] = row[field];
  }
  const content = row.content;
  if (content && typeof content === "object") {
    const src = content as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const field of PARTICIPANT_CONTENT_FIELDS) {
      if (field in src) out[field] = src[field];
    }
    view.content = out;
  }
  return view;
}

export async function GET(req: NextRequest, context: any) {

  try {
    const { id } = await context.params;

    if (!id) {
      return NextResponse.json({ error: "ID required" }, { status: 400 });
    }

    const hackathon = await getHackathon(id)

    if (hackathon?.is_public !== true) {
      const session = await getAuthSession();

      // Anonymous callers learn nothing about a private event: that is the
      // disclosure this endpoint closes.
      if (!session?.user?.id) {
        return NextResponse.json({ error: "Hackathon not found" }, { status: 404 });
      }

      // A signed-in participant still has to register for a private event and
      // submit a project, and both flows read this endpoint. Gating the whole
      // record on the organizer rule broke them, so the record is returned
      // without the organizer-only fields instead.
      if (!(await canViewPrivateEvent(session, hackathon))) {
        return NextResponse.json(participantView(hackathon));
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
