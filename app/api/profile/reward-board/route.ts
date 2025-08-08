import { withAuth } from "@/lib/protectedRoute";
import { getRewardBoard } from "@/server/services/rewardBoard";
import { NextResponse } from "next/server";

export const GET = withAuth(async (request, context, session) => {
  const { searchParams } = new URL(request.url);
  const user_id = searchParams.get("user_id");
  if (!user_id) {
    return NextResponse.json(
      { error: "user_id parameter is required" },
      { status: 400 }
    );
  }

  try {
    const badges = await getRewardBoard(user_id);
    return NextResponse.json(badges, { status: 200 });
  } catch (error) {
    console.error("Error getting reward board:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
});
