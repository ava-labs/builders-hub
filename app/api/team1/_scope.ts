/**
 * Resolves the authenticated caller's permission scope for Team One API
 * routes. The scope captures both "can they write?" and "which region?".
 *
 * - `devrel` users get full access.
 * - `team1-admin` users must also have a non-null `User.team_id`; we look
 *   it up fresh from the DB (the JWT session only carries roles, not the
 *   team_id, so a stale token can't widen a former admin's access).
 * - Anyone else: null (caller should return 403).
 */

import type { Session } from "next-auth";
import { prisma } from "@/prisma/prisma";
import { hasRoleGroup } from "@/lib/auth/roles";
import type { CallerScope } from "@/server/services/team1";
import { isTeam1Region } from "@/server/services/team1";

export async function resolveTeam1Scope(
  session: Session | null,
): Promise<CallerScope | null> {
  const userId = session?.user?.id;
  if (!userId) return null;
  const attrs = session.user?.custom_attributes ?? [];

  if (hasRoleGroup(attrs, "team1Edit") === false) return null;

  if (attrs.includes("devrel")) {
    return { kind: "devrel" };
  }

  if (attrs.includes("team1-admin")) {
    const me = await prisma.user.findUnique({
      where: { id: userId },
      select: { team_id: true },
    });
    if (!me?.team_id || !isTeam1Region(me.team_id)) return null;
    return { kind: "team1-admin", teamId: me.team_id };
  }

  return null;
}
