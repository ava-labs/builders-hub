import { NextResponse } from "next/server";
import type { Session } from "next-auth";

import { withAuth } from "@/lib/protectedRoute";
import { searchAssignablePool } from "@/server/services/team1";
import { resolveTeam1Scope } from "../_scope";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const GET = withAuth(async (req, _ctx: unknown, session: Session) => {
  const scope = await resolveTeam1Scope(session);
  if (!scope) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const q = req.nextUrl.searchParams.get("q")?.trim() ?? "";
  const limitParam = Number(req.nextUrl.searchParams.get("limit") ?? "20");
  const limit = Number.isFinite(limitParam) ? limitParam : 20;

  try {
    const pool = await searchAssignablePool({ query: q, limit });
    return NextResponse.json({ pool });
  } catch (err) {
    console.error("[team1/pool] error:", err);
    return NextResponse.json(
      { error: "Failed to search builders" },
      { status: 500 },
    );
  }
});
