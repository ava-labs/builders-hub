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
        { error: "project_id parameter is required" },
        { status: 400 }
      );
    }
    if (!body.isWinner) {
      return NextResponse.json(
        { error: "IsWinner parameter is required" },
        { status: 400 }
      );
    }
    const badge = await SetWinner(body.project_id, body.isWinner, name);

    return NextResponse.json(badge, { status: 200 });
  } catch (error) {
    console.error("Error checking user by email:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
});
