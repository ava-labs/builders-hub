import { withAuth } from "@/lib/protectedRoute";
import { getAllBadges, getBadgeByCourseId } from "@/server/services/badge";

import { NextResponse } from "next/server";

export const GET = withAuth(async () => {
  try {
    const badges = await getAllBadges();
    return NextResponse.json(badges, { status: 200 });
  } catch (error) {
    console.error("Error getting badge:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
});
