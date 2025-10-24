import { withAuth } from "@/lib/protectedRoute";

import { getProjectBadges } from "@/server/services/project-badge";

import { NextResponse } from "next/server";

export const GET = withAuth(async (request) => {
  const { searchParams } = new URL(request.url);
  const project_id = searchParams.get("project_id");
  if (!project_id) {
    return NextResponse.json(
      { error: "project_id parameter is required" },
      { status: 400 }
    );
  }

  try {
    const badge = await getProjectBadges(project_id);
    return NextResponse.json(badge, { status: 200 });
  } catch (error) {
    console.error("Error getting badge:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
});
