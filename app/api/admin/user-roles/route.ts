/**
 * Admin API — User Role Management
 *
 * Allows devrel to assign, update, and revoke roles for any user.
 * Roles can optionally carry an expiration date (expires_at).
 *
 * Protected by: user:manage (only devrel have this permission).
 *
 * Endpoints:
 *   GET    /api/admin/user-roles?user_id=<id>  List active roles for a user
 *   POST   /api/admin/user-roles               Assign (or update) a role
 *   DELETE /api/admin/user-roles               Revoke a role
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { withAuthPermission } from "@/lib/protectedRoute";
import { prisma } from "@/prisma/prisma";
import { ROLE_PERMISSIONS, getPermissionsFromRoles } from "@/lib/auth/rolePermissions";
import { activeRoleWhere, revokerForClose } from "@/lib/auth/permissions";

// ---------------------------------------------------------------------------
// Validation schemas
// ---------------------------------------------------------------------------

const assignSchema = z.object({
  user_id: z.string().min(1),
  // Object.hasOwn: "r in ROLE_PERMISSIONS" would also accept prototype-chain
  // keys like "constructor" or "__proto__".
  role: z.string().min(1).refine((r) => Object.hasOwn(ROLE_PERMISSIONS, r), {
    message: `Role must be one of: ${Object.keys(ROLE_PERMISSIONS).join(", ")}`,
  }),
  expires_at: z
    .string()
    .datetime({ offset: true })
    .refine((d) => new Date(d) > new Date(), { message: "expires_at must be in the future" })
    .nullish(),
  // Optional free text: why this role is being given.
  comment: z.string().trim().max(500).nullish(),
});

const revokeSchema = z.object({
  user_id: z.string().min(1),
  role: z.string().min(1),
  // Optional free text: why this role is being taken away.
  comment: z.string().trim().max(500).nullish(),
});

// ---------------------------------------------------------------------------
// Anti-escalation helper
// ---------------------------------------------------------------------------

/**
 * Guards only the top tier: a target role carrying a wildcard-resource
 * permission (resource === "*", i.e. devrel) can only be granted
 * by an actor who also holds a wildcard-resource permission. Non-wildcard
 * roles are grantable by anyone with user:manage — today that is only
 * wildcard-holders anyway. If a scoped user-admin role is ever introduced,
 * extend this to compare full permission sets for grant AND revoke.
 */
function canActorGrantRole(actorRoles: string[], targetRole: string): boolean {
  const targetPerms = Object.hasOwn(ROLE_PERMISSIONS, targetRole)
    ? ROLE_PERMISSIONS[targetRole]
    : [];
  const hasWildcardResource = targetPerms.some((p) => p.resource === "*");
  if (!hasWildcardResource) return true;

  const actorPerms = getPermissionsFromRoles(actorRoles);
  return actorPerms.some((p) => p.resource === "*");
}

// ---------------------------------------------------------------------------
// GET /api/admin/user-roles?user_id=<id>
// ---------------------------------------------------------------------------

export const GET = withAuthPermission(
  { resource: "user", action: "manage" },
  async (req: NextRequest) => {
    try {
      const { searchParams } = new URL(req.url);
      const user_id = searchParams.get("user_id");

      if (!user_id) {
        return NextResponse.json(
          { error: "user_id query param is required" },
          { status: 400 },
        );
      }

      const user = await prisma.user.findUnique({
        where: { id: user_id },
        select: { id: true, name: true, email: true },
      });

      if (!user) {
        return NextResponse.json({ error: "User not found" }, { status: 404 });
      }

      // Every episode, not just the open ones: revoked rows ARE the audit log.
      const roles = await prisma.userRole.findMany({
        where: { user_id },
        orderBy: { granted_at: "desc" },
        select: {
          id: true,
          role: true,
          expires_at: true,
          granted_by: true,
          granted_at: true,
          granted_comment: true,
          revoked_by: true,
          revoked_at: true,
          revoked_comment: true,
        },
      });

      // granted_by / revoked_by hold user ids with no FK (audit rows outlive the
      // accounts that wrote them), so resolve names here in one lookup. An id
      // whose User row is gone resolves to null and the UI shows the raw id.
      const actorIds = [
        ...new Set(
          roles
            .flatMap((r) => [r.granted_by, r.revoked_by])
            .filter((id): id is string => !!id),
        ),
      ];
      const actors = actorIds.length
        ? await prisma.user.findMany({
            where: { id: { in: actorIds } },
            select: { id: true, name: true, email: true },
          })
        : [];
      const actorById = new Map(actors.map((a) => [a.id, a]));

      const now = new Date();
      type RoleRow = typeof roles[number];
      const enriched = roles.map((r: RoleRow) => ({
        ...r,
        active:
          r.revoked_at === null && (r.expires_at === null || r.expires_at > now),
        granted_by_user: r.granted_by ? actorById.get(r.granted_by) ?? null : null,
        revoked_by_user: r.revoked_by ? actorById.get(r.revoked_by) ?? null : null,
        permissions: ROLE_PERMISSIONS[r.role] ?? [],
      }));

      return NextResponse.json({
        user: { id: user.id, name: user.name, email: user.email },
        roles: enriched,
      });
    } catch (err) {
      console.error("user-roles GET failed:", err instanceof Error ? err.message : err);
      return NextResponse.json(
        { error: "Internal server error", message: "Unexpected error handling the request" },
        { status: 500 },
      );
    }
  },
);

// ---------------------------------------------------------------------------
// POST /api/admin/user-roles
// Body: { user_id, role, expires_at? }
// ---------------------------------------------------------------------------

export const POST = withAuthPermission(
  { resource: "user", action: "manage" },
  async (req: NextRequest, _ctx: unknown, session: any) => {
    try {
      const raw = await req.json().catch(() => null);
      const parsed = assignSchema.safeParse(raw);
      if (!parsed.success) {
        return NextResponse.json(
          { error: "Invalid request", details: parsed.error.flatten().fieldErrors },
          { status: 400 },
        );
      }

      const { user_id, role, expires_at, comment } = parsed.data;

      // Anti-escalation: actor cannot grant roles with wider permissions than their own
      const actorRoles: string[] = session.user.custom_attributes ?? [];
      if (!canActorGrantRole(actorRoles, role)) {
        return NextResponse.json(
          { error: "Forbidden: cannot grant a role with permissions exceeding your own" },
          { status: 403 },
        );
      }

      const targetUser = await prisma.user.findUnique({
        where: { id: user_id },
        select: { id: true },
      });
      if (!targetUser) {
        return NextResponse.json({ error: "User not found" }, { status: 404 });
      }

      const expiresAt = expires_at ? new Date(expires_at) : null;

      // Grants are append-only: any open episode (including an expiry change on
      // a role the user already holds) is closed and a new row opened, so the
      // history keeps who granted what and who changed it. The partial unique
      // index allows only one open row per (user, role), so both steps must
      // land together or neither.
      const userRole = await prisma.$transaction(async (tx) => {
        const now = new Date();
        const open = await tx.userRole.findFirst({
          where: { user_id, role, revoked_at: null },
          select: { id: true, expires_at: true },
        });
        if (open) {
          await tx.userRole.update({
            where: { id: open.id },
            data: {
              revoked_at: now,
              revoked_by: revokerForClose(open, session.user.id, now),
            },
          });
        }
        return tx.userRole.create({
          data: {
            user_id,
            role,
            expires_at: expiresAt,
            granted_by: session.user.id,
            granted_comment: comment ?? null,
          },
        });
      });

      console.log(JSON.stringify({
        event: "role_assigned",
        actor: session.user.id,
        target: user_id,
        role,
        expires_at: expiresAt?.toISOString() ?? null,
        ts: new Date().toISOString(),
      }));

      return NextResponse.json(
        {
          ...userRole,
          permissions: ROLE_PERMISSIONS[role] ?? [],
        },
        { status: 201 },
      );
    } catch (err) {
      console.error("user-roles POST failed:", err instanceof Error ? err.message : err);
      return NextResponse.json(
        { error: "Internal server error", message: "Unexpected error handling the request" },
        { status: 500 },
      );
    }
  },
);

// ---------------------------------------------------------------------------
// DELETE /api/admin/user-roles
// Body: { user_id, role }
// ---------------------------------------------------------------------------

export const DELETE = withAuthPermission(
  { resource: "user", action: "manage" },
  async (req: NextRequest, _ctx: unknown, session: any) => {
    try {
      const raw = await req.json().catch(() => null);
      const parsed = revokeSchema.safeParse(raw);
      if (!parsed.success) {
        return NextResponse.json(
          { error: "Invalid request", details: parsed.error.flatten().fieldErrors },
          { status: 400 },
        );
      }

      const { user_id, role, comment } = parsed.data;

      // activeRoleWhere(), not just revoked_at: revoking a grant that already
      // lapsed would stamp revoked_by on an episode nobody revoked. The user
      // does not hold the role, so there is nothing to take away.
      const open = await prisma.userRole.findFirst({
        where: { user_id, role, ...activeRoleWhere() },
        select: { id: true },
      });

      if (!open) {
        return NextResponse.json(
          { error: "Role assignment not found" },
          { status: 404 },
        );
      }

      // Closed, never deleted — the row is the record of who held the role and
      // who took it away.
      await prisma.userRole.update({
        where: { id: open.id },
        data: {
          revoked_at: new Date(),
          revoked_by: session.user.id,
          revoked_comment: comment ?? null,
        },
      });

      console.log(JSON.stringify({
        event: "role_revoked",
        actor: session.user.id,
        target: user_id,
        role,
        ts: new Date().toISOString(),
      }));

      return NextResponse.json({ success: true, revoked: { user_id, role } });
    } catch (err) {
      console.error("user-roles DELETE failed:", err instanceof Error ? err.message : err);
      return NextResponse.json(
        { error: "Internal server error", message: "Unexpected error handling the request" },
        { status: 500 },
      );
    }
  },
);
