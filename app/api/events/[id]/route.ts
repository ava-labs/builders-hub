import { NextRequest, NextResponse } from "next/server";
import { getHackathon, updateHackathon } from "@/server/services/hackathons";
import { HackathonHeader } from "@/types/hackathons";
import { withAuth } from "@/lib/protectedRoute";
import { getAuthSession } from "@/lib/auth/authSession";
import { canEditEvent } from "@/lib/auth/permissions";
import { z } from "zod";
import { readJsonBody } from "@/lib/api/json-body";

// updateHackathon reads these fields and returns the body it got, so keys that are not listed here pass
// through unchanged. A field that maps to a nullable column accepts null, because the edit forms send the
// stored event back. The service checks the required fields itself and answers with `details`.
const putBodySchema = z.looseObject({
  title: z.string().optional(),
  description: z.string().optional(),
  start_date: z.string().optional(),
  end_date: z.string().optional(),
  location: z.string().optional(),
  // The edit page sends null when it read no number. The service then answers with its own `details`.
  total_prizes: z.number().nullish(),
  participants: z.number().nullish(),
  tags: z.array(z.string()).optional(),
  timezone: z.string().optional(),
  icon: z.string().optional(),
  banner: z.string().optional(),
  small_banner: z.string().optional(),
  cohosts: z.array(z.string()).optional(),
  organizers: z.string().nullish(),
  top_most: z.boolean().nullish(),
  custom_link: z.string().nullish(),
  created_by: z.string().nullish(),
  is_public: z.boolean().nullish(),
  event: z.string().nullish(),
  new_layout: z.boolean().nullish(),
  google_calendar_id: z.string().nullish(),
  content: z.record(z.string(), z.unknown()).optional(),
});

const patchBodySchema = z.object({
  is_public: z.boolean().optional(),
});

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
    const updateData = await readJsonBody(req, putBodySchema);
    if (!updateData) {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }
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
      return NextResponse.json({ error: 'Invalid request body', details }, { status: 400 });
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
    const updateData = await readJsonBody(req, patchBodySchema);
    if (!updateData) {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }
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
