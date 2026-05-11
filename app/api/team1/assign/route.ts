import { NextResponse } from "next/server";
import type { Session } from "next-auth";

import { withAuth } from "@/lib/protectedRoute";
import { TEAM1_HIERARCHY_ROLES, type Team1Role } from "@/lib/auth/roles";
import { assignMember } from "@/server/services/team1";
import { resolveTeam1Scope } from "../_scope";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function isTeam1Role(value: unknown): value is Team1Role {
  return (
    typeof value === "string" &&
    (TEAM1_HIERARCHY_ROLES as readonly string[]).includes(value)
  );
}

export const POST = withAuth(async (req, _ctx: unknown, session: Session) => {
  const scope = await resolveTeam1Scope(session);
  if (!scope) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: { builderId?: unknown; teamId?: unknown; role?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const builderId = typeof body.builderId === "string" ? body.builderId : null;
  const teamId = typeof body.teamId === "string" ? body.teamId : null;
  const role = isTeam1Role(body.role) ? body.role : null;
  if (!builderId || !teamId || !role) {
    return NextResponse.json(
      { error: "builderId, teamId and role are required" },
      { status: 400 },
    );
  }

  try {
    const result = await assignMember({
      callerScope: scope,
      builderId,
      teamId,
      role,
    });
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[team1/assign] error:", err);
    const status = /Forbidden/i.test(message)
      ? 403
      : /not found/i.test(message)
        ? 404
        : /invalid/i.test(message)
          ? 400
          : 500;
    return NextResponse.json({ error: message }, { status });
  }
});
