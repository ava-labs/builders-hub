import { withAuth } from "@/lib/protectedRoute";
import { NextResponse } from "next/server";
import { CheckInvitation } from "@/server/services/projects";

export const GET = withAuth(async (request, context, session) => {
  const { searchParams } = new URL(request.url);
  const invitationId = searchParams.get("invitation");
  const user_id = searchParams.get("user_id");

  if (!invitationId) {
    return NextResponse.json(
      { error: "invitationId parameter is required" },
      { status: 400 }
    );
  }

  // Verify that user_id matches the authenticated session user
  if (user_id !== null && user_id !== undefined && user_id !== "" && user_id !== session.user.id) {
    return NextResponse.json(
      { error: "Forbidden: You can only check invitations for yourself" },
      { status: 403 }
    );
  }

  try {
    const sessionUserId = session.user.id;
    const member = await CheckInvitation(invitationId, sessionUserId);
    return NextResponse.json(member, { status: 200 });
  } catch (error) {
    console.error("Error checking invitation:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
});
