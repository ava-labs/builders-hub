import { withAuth } from "@/lib/protectedRoute";
import { generateInvitation } from "@/server/services/inviteProjectMember";
import { isUserProjectMember } from "@/server/services/fileValidation";
import { NextResponse } from "next/server";

export const POST = withAuth(async (request, context, session) => {
  try {
    const body = await request.json();
    
    // Verify user_id matches session
    if (body.user_id !== null && body.user_id !== undefined && body.user_id !== "" && body.user_id !== session.user.id) {
      return NextResponse.json(
        { error: "Forbidden: You can only invite members on behalf of yourself" },
        { status: 403 }
      );
    }

    // If project_id is provided, verify user is a member of the project
    if (body.project_id) {
      const isMember = await isUserProjectMember(session.user.id, body.project_id);
      if (!isMember) {
        return NextResponse.json(
          { error: "Forbidden: You must be a member of the project to invite others" },
          { status: 403 }
        );
      }
    }

    const result = await generateInvitation(
      body.hackathon_id,
      session.user.id, // Use session user ID
      session.user.name,
      body.emails
    );
    return NextResponse.json(
      { message: "invitation sent", result },
      { status: 200 }
    );
  } catch (error: any) {
    console.error("Error inviting members:", error);
    console.error("Error POST /api/submit-project:", error.message);
    const wrappedError = error as Error;
    return NextResponse.json(
      { error: wrappedError },
      { status: wrappedError.cause == "ValidationError" ? 400 : 500 }
    );
  }
});
