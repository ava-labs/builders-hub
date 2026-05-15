import { NextResponse } from "next/server";
import type { Session } from "next-auth";

import { withAuth } from "@/lib/protectedRoute";
import { getOrgTree } from "@/server/services/team1";
import { resolveTeam1Scope } from "../_scope";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const GET = withAuth(async (_req, _ctx: unknown, session: Session) => {
  const scope = await resolveTeam1Scope(session);
  if (!scope) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  try {
    const regions = await getOrgTree(scope);
    return NextResponse.json({ regions });
  } catch (err) {
    console.error("[team1/org] error:", err);
    return NextResponse.json(
      { error: "Failed to load Team 1 org" },
      { status: 500 },
    );
  }
});
