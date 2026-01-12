import { withAuth } from "@/lib/protectedRoute";
import { UpdateStatusMember } from "@/server/services/memberProject";
import { isUserProjectMember } from "@/server/services/projects";
import { NextResponse } from "next/server";

export const PATCH = withAuth(async (request: Request, context: any, session: any) => {
  try {
    const body = await request.json();
    const { user_id, status, email, wasInOtherProject } = body;
    const { project_id } = await context.params;

    if (!project_id) {
      return NextResponse.json(
        { error: "project_id is required" },
        { status: 400 }
      );
    }

    // Check if user is a member of the project
    const isMember = await isUserProjectMember(session.user.id, project_id);
    if (!isMember) {
      return NextResponse.json(
        { error: "Forbidden: You are not a member of this project" },
        { status: 403 }
      );
    }

    // Verify that user_id matches session user (users can only update their own status)
    if (user_id !== null && user_id !== undefined && user_id !== "" && user_id !== session.user.id) {
      return NextResponse.json(
        { error: "Forbidden: You can only update your own member status" },
        { status: 403 }
      );
    }

    const updatedMember = await UpdateStatusMember(session.user.id, project_id, status, session.user.email || "", wasInOtherProject);
    return NextResponse.json(updatedMember);
  } catch (error: any) {
    console.error('Error updating member status:', error);
    const wrappedError = error as Error;
    return NextResponse.json(
      { error: wrappedError.message || "Internal server error" },
      { status: wrappedError.cause === 'ValidationError' ? 400 : 500 }
    );
  }
});