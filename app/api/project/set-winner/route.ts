import { Session } from 'next-auth';
import { withAuthRole } from "@/lib/protectedRoute";
import { SetWinner } from "@/server/services/set-project-winner";
import { NextRequest, NextResponse } from "next/server";

export const PUT = withAuthRole("badge_admin", async (req: NextRequest, _context: unknown, session: Session) => {
  const body = await req.json();
  const name = session.user.name || "user";

  try {
    if (!body.project_id) {
      return NextResponse.json(
        { success: false, error: "project_id parameter is required" },
        { status: 400 }
      );
    }
    if (body.isWinner === undefined) {
      return NextResponse.json(
        { success: false, error: "isWinner parameter is required" },
        { status: 400 }
      );
    }
    
    const result = await SetWinner(body.project_id, body.isWinner, name);

    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    console.error("Error setting project winner:", error);
    
    // Handle known, safe errors that can be exposed to the client
    if (error instanceof Error && error.message === "Project not found") {
      return NextResponse.json(
        { success: false, error: "Project not found" },
        { status: 404 }
      );
    }
    
    // For all other errors, return a generic message to avoid leaking internal details
    return NextResponse.json(
      { success: false, error: "Failed to update project winner status" },
      { status: 500 }
    );
  }
});
