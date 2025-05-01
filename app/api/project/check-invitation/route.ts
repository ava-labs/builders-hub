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

  try {
    const member = await CheckInvitation(invitationId,user_id as string);
    return NextResponse.json(member, { status: 200 });
  } catch (error) {
    console.error("Error checking user by email:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
});
