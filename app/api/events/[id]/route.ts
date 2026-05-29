import { NextRequest, NextResponse } from "next/server";
import { getHackathon, updateHackathon, canManageHackathon } from "@/server/services/hackathons";
import { HackathonHeader } from "@/types/hackathons";
import { withAuthRole } from "@/lib/protectedRoute";
import { ROLE_GROUPS } from "@/lib/auth/roles";
import { getAuthSession } from "@/lib/auth/authSession";
import { getUserById } from "@/server/services/getUser";

/**
 * Minimal, non-sensitive view of a private event for authenticated callers
 * who are not managers/owners/cohosts (e.g. invitees loading the registration
 * page). Includes only the fields the registration form and its children read,
 * plus the eligibility/display fields it may surface. Deliberately omits
 * sensitive/admin data: judging_guidelines, cohosts, created_by, evaluation
 * and judge config, stage `submitForm` internals, custom links, etc.
 *
 * `organizers` is intentionally kept: it is a non-sensitive team_id already
 * shown publicly on event cards/layouts, and the registration form uses it to
 * detect Team1 events (mandatory sharing consent). `cohosts` stays excluded
 * because it is a list of admin emails; cohost-only Team1 detection is still
 * enforced server-side on submit in /api/register-form.
 */
function buildRegistrationProjection(hackathon: HackathonHeader) {
  const content = hackathon.content ?? ({} as HackathonHeader["content"]);
  return {
    id: hackathon.id,
    title: hackathon.title,
    start_date: hackathon.start_date,
    end_date: hackathon.end_date,
    location: hackathon.location,
    banner: hackathon.banner,
    icon: hackathon.icon,
    timezone: hackathon.timezone,
    event: hackathon.event,
    organizers: hackathon.organizers,
    content: {
      language: content.language,
      registration_mode: content.registration_mode,
      team_size_min: content.team_size_min,
      team_size_max: content.team_size_max,
      target_countries: content.target_countries,
      country: content.country,
      is_remote: content.is_remote,
    },
  };
}

export async function GET(req: NextRequest, context: any) {

  try {
    const { id } = await context.params;

    if (!id) {
      return NextResponse.json({ error: "ID required" }, { status: 400 });
    }

    const hackathon = await getHackathon(id)

    // Private/draft events are only fully readable by managers (devrel or the
    // organizing team's admin), the creator, or a cohost.
    //
    //   public                        -> full event (anyone)
    //   private + manager/owner/cohost-> full event
    //   private + authenticated, other-> registration-safe projection
    //   private + anonymous           -> 404
    //
    // Authenticated non-managers (e.g. invitees) still need to load a private
    // event's registration page, so they get a minimal, non-sensitive
    // projection instead of the full record. Sensitive/admin fields
    // (judging_guidelines, cohosts, created_by, stages/submitForm internals,
    // evaluation/judge config, custom links, etc.) are never included.
    if (hackathon.is_public !== true) {
      const session = await getAuthSession();
      const actingUser = session?.user?.id ? await getUserById(session.user.id) : null;
      const isOwner = !!session?.user?.id && hackathon.created_by === session.user.id;
      const isCohost = !!session?.user?.email && (hackathon.cohosts ?? []).includes(session.user.email);
      if (!canManageHackathon(actingUser, hackathon) && !isOwner && !isCohost) {
        // Anonymous callers see nothing.
        if (!session?.user?.id) {
          return NextResponse.json({ error: "Hackathon not found" }, { status: 404 });
        }
        return NextResponse.json(buildRegistrationProjection(hackathon));
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
