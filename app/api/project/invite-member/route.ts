import { Session } from 'next-auth';
import { withAuth } from "@/lib/protectedRoute";
import { prisma } from "@/prisma/prisma";
import { generateInvitation } from "@/server/services/inviteProjectMember";
import { isProjectMemberOrInvitee } from "@/server/services/projectMembership";
import { checkRateLimit } from "@/lib/rateLimit";
import { inviteSchema, inviteErrorMessage } from "@/lib/invitations/inviteSchema";
import { NextResponse } from "next/server";
import { normalizeEventsLang } from "@/lib/events/i18n";

// Any signed-up account could otherwise point this endpoint at unlimited arbitrary
// inboxes and send mail from our own sending domain.
const INVITE_WINDOW_MS = 60 * 60 * 1000;
const MAX_INVITE_REQUESTS_PER_WINDOW = 10;

export const POST = withAuth(async (request, _context: unknown, session: Session) => {
  try {
    const rawBody = await request.json();
    const parsed = inviteSchema.safeParse(rawBody);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Invalid input",
          message: inviteErrorMessage(rawBody, parsed.error),
          issues: parsed.error.issues,
        },
        { status: 400 }
      );
    }
    const body = parsed.data;
    const projectId = body.project_id || undefined;

    // Verify user_id matches session
    if (body.user_id !== null && body.user_id !== undefined && body.user_id !== "" && body.user_id !== session.user.id) {
      return NextResponse.json(
        { error: "Forbidden: You can only invite members on behalf of yourself" },
        { status: 403 }
      );
    }

    const limit = checkRateLimit(`invite-member:${session.user.email ?? session.user.id}`, {
      windowMs: INVITE_WINDOW_MS,
      maxRequests: MAX_INVITE_REQUESTS_PER_WINDOW,
    });
    if (!limit.allowed) {
      return NextResponse.json(
        { error: "Rate limit exceeded", message: "Too many invitations sent. Please try again later." },
        { status: 429 }
      );
    }

    // If project_id is provided, verify user is a member of the project
    if (projectId) {
      const isMember = await isProjectMemberOrInvitee(session.user.id, projectId);
      if (!isMember) {
        return NextResponse.json(
          { error: "Forbidden: You must be a member of the project to invite others" },
          { status: 403 }
        );
      }
    } else {
      // Only this path writes hackathon_id into a project FK, so only this path
      // needs the row to exist. Checking it unconditionally would break the
      // mini-grant wizard, which invites (step 4) before the submit that lazily
      // creates its backing hackathon row via ensureGrantHackathon (step 5).
      const hackathon = await prisma.hackathon.findUnique({
        where: { id: body.hackathon_id },
        select: { id: true },
      });
      if (!hackathon) {
        return NextResponse.json({ error: "Unknown hackathon" }, { status: 400 });
      }
    }

    const lang = normalizeEventsLang(body.lang);
    const result = await generateInvitation(
      body.hackathon_id,
      session.user.id, // Use session user ID
      session.user?.name ?? "",
      body.emails,
      projectId,
      body.stage,
      lang
    );
    return NextResponse.json(
      { message: "invitation sent", result },
      { status: 200 }
    );
  } catch (error: any) {
    console.error("Error inviting members:", error);
    const wrappedError = error as Error;
    return NextResponse.json(
      { error: wrappedError.message || "Internal server error" },
      { status: wrappedError.cause == "ValidationError" ? 400 : 500 }
    );
  }
});
