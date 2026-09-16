import { withAuth } from "@/lib/protectedRoute";
import { getBadgeByCourseId } from "@/server/services/badge";

import { NextResponse } from "next/server";

export const GET = withAuth(async (request, _context, session) => {
  const { searchParams } = new URL(request.url);
  const course_id = searchParams.get("course_id");
  const user_id = searchParams.get("user_id");
  if (!course_id) {
    return NextResponse.json(
      { error: "course_id parameter is required" },
      { status: 400 }
    );
  }
  if (!user_id) {
    return NextResponse.json(
      { error: "user_id parameter is required" },
      { status: 400 }
    );
  }
  if (user_id !== session.user.id) {
    return NextResponse.json(
      { error: "Forbidden: You can only query your own badge status" },
      { status: 403 }
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
