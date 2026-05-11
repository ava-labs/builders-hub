import { NextResponse } from "next/server";
import type { Session } from "next-auth";

import { withAuth } from "@/lib/protectedRoute";
import { removeMember } from "@/server/services/team1";
import { resolveTeam1Scope } from "../_scope";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const POST = withAuth(async (req, _ctx: unknown, session: Session) => {
  const scope = await resolveTeam1Scope(session);
  if (!scope) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: { memberId?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const memberId = typeof body.memberId === "string" ? body.memberId : null;
  if (!memberId) {
    return NextResponse.json(
      { error: "memberId is required" },
      { status: 400 },
    );
  }

  try {
    const result = await removeMember({
      callerScope: scope,
      memberId,
    });
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[team1/remove] error:", err);
    const status = /Forbidden/i.test(message)
      ? 403
      : /not found/i.test(message)
        ? 404
        : /Cannot remove/i.test(message)
          ? 409
          : 500;
    return NextResponse.json({ error: message }, { status });
  }
});
