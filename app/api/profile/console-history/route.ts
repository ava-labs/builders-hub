import { NextResponse, type NextRequest } from "next/server";
import type { Session } from "next-auth";

import { withAuth } from "@/lib/protectedRoute";
import { getConsoleHistory, InvalidCursorError } from "@/server/services/console-history";

// GET /api/profile/console-history?cursor=&limit= : the session user's Console history, newest first
export const GET = withAuth(async (request: NextRequest, _context: unknown, session: Session) => {
  const userId = session.user?.id;
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const params = request.nextUrl.searchParams;
  try {
    const page = await getConsoleHistory(userId, {
      cursor: params.get("cursor") || null,
      limit: params.get("limit"),
    });
    return NextResponse.json(page, { headers: { "Cache-Control": "private, no-store" } });
  } catch (err) {
    if (err instanceof InvalidCursorError) {
      return NextResponse.json({ error: "Invalid cursor" }, { status: 400 });
    }
    console.error("[profile/console-history] error:", err);
    return NextResponse.json({ error: "Failed to load Console history" }, { status: 500 });
  }
});
