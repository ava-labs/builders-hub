import { NextResponse } from "next/server";
import type { Session } from "next-auth";

import { withAuth } from "@/lib/protectedRoute";
import { getProfileBoards } from "@/server/services/query-boards";

export const dynamic = "force-dynamic";

/* GET /api/profile/query-boards
   The signed-in user's Query boards in every scope, newest first, with
   the Playground dashboards that have not become boards yet. */
export const GET = withAuth(async (_request, _context: unknown, session: Session) => {
  const userId = session.user?.id;
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  // a user who has not accepted the terms has no account row, so no boards
  if (userId.startsWith("pending_")) {
    return NextResponse.json({ boards: [] });
  }

  try {
    return NextResponse.json(await getProfileBoards(userId));
  } catch (error) {
    console.error("[profile/query-boards] error:", error);
    return NextResponse.json({ error: "Failed to load Query boards" }, { status: 500 });
  }
});
