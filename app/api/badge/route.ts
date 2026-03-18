import { withAuth } from "@/lib/protectedRoute";
import { getBadgeByCourseId } from "@/server/services/rewardBoard";
import { NextResponse } from "next/server";

export const GET = withAuth(async (request) => {
  const { searchParams } = new URL(request.url);
  const course_id = searchParams.get("course_id");
  if (!course_id) {
    return NextResponse.json(
      { error: "course_id parameter is required" },
      { status: 400 }
    );
  }

  try {
    const badge = await getBadgeByCourseId(course_id);
    return NextResponse.json(badge, { status: 200 });
  } catch (error) {
    console.error("Error getting badge:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
});
