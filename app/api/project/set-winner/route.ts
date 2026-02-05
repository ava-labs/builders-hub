import { getAuthSession } from "@/lib/auth/authSession";
import { withAuthRole } from "@/lib/protectedRoute";
import { SetWinner } from "@/server/services/set-project-winner";
import { NextRequest, NextResponse } from "next/server";

export const PUT = withAuthRole("badge_admin", async (req: NextRequest) => {
  const body = await req.json();
  const session = await getAuthSession();
  const name = session?.user.name || "user";

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
    const errorMessage = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json(
      { success: false, error: errorMessage, message: errorMessage },
      { status: 500 }
    );
  }
});
