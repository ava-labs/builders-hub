/**
 * Admin API — User Role Management
 *
 * Allows superadmin / devrel to assign, update, and revoke roles for any user.
 * Roles can optionally carry an expiration date (expires_at).
 *
 * Protected by: user:manage (only superadmin / devrel have this permission).
 *
 * Endpoints:
 *   GET    /api/admin/user-roles?user_id=<id>  List active roles for a user
 *   POST   /api/admin/user-roles               Assign (or update) a role
 *   DELETE /api/admin/user-roles               Revoke a role
 */

import { NextRequest, NextResponse } from "next/server";
import { withAuthPermission } from "@/lib/protectedRoute";
import { prisma } from "@/prisma/prisma";
import { ROLE_PERMISSIONS } from "@/lib/auth/rolePermissions";

// ---------------------------------------------------------------------------
// GET /api/admin/user-roles?user_id=<id>
// ---------------------------------------------------------------------------

export const GET = withAuthPermission(
  { resource: "user", action: "manage" },
  async (req: NextRequest) => {
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
      select: { id: true, name: true, email: true, custom_attributes: true },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const roles = await prisma.userRole.findMany({
      where: { user_id },
      orderBy: { created_at: "desc" },
      select: {
        id: true,
        role: true,
        expires_at: true,
        granted_by: true,
        created_at: true,
        updated_at: true,
      },
    });

    const now = new Date();
    type RoleRow = typeof roles[number];
    const enriched = roles.map((r: RoleRow) => ({
      ...r,
      active: r.expires_at === null || r.expires_at > now,
      permissions: ROLE_PERMISSIONS[r.role] ?? [],
    }));

    return NextResponse.json({
      user: { id: user.id, name: user.name, email: user.email },
      /** Legacy roles stored in custom_attributes (read-only via this endpoint) */
      legacy_attributes: user.custom_attributes,
      roles: enriched,
    });
  },
);

// ---------------------------------------------------------------------------
// POST /api/admin/user-roles
// Body: { user_id, role, expires_at? }
// ---------------------------------------------------------------------------

export const POST = withAuthPermission(
  { resource: "user", action: "manage" },
  async (req: NextRequest, _ctx: unknown, session: any) => {
    const body = await req.json().catch(() => null);

    if (!body || !body.user_id || !body.role) {
      return NextResponse.json(
        { error: "user_id and role are required" },
        { status: 400 },
      );
    }

    const { user_id, role, expires_at } = body as {
      user_id: string;
      role: string;
      expires_at?: string | null;
    };

    // Validate that the role is known
    if (!(role in ROLE_PERMISSIONS)) {
      return NextResponse.json(
        {
          error: `Unknown role "${role}". Valid roles: ${Object.keys(ROLE_PERMISSIONS).join(", ")}`,
        },
        { status: 400 },
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
    if (expiresAt && isNaN(expiresAt.getTime())) {
      return NextResponse.json(
        { error: "Invalid expires_at date format" },
        { status: 400 },
      );
    }

    const userRole = await prisma.userRole.upsert({
      where: { user_id_role: { user_id, role } },
      create: {
        user_id,
        role,
        expires_at: expiresAt,
        granted_by: session.user.id,
      },
      update: {
        expires_at: expiresAt,
        granted_by: session.user.id,
      },
    });

    return NextResponse.json(
      {
        ...userRole,
        permissions: ROLE_PERMISSIONS[role] ?? [],
      },
      { status: 201 },
    );
  },
);

// ---------------------------------------------------------------------------
// DELETE /api/admin/user-roles
// Body: { user_id, role }
// ---------------------------------------------------------------------------

export const DELETE = withAuthPermission(
  { resource: "user", action: "manage" },
  async (req: NextRequest) => {
    const body = await req.json().catch(() => null);

    if (!body || !body.user_id || !body.role) {
      return NextResponse.json(
        { error: "user_id and role are required" },
        { status: 400 },
      );
    }

    const { user_id, role } = body as { user_id: string; role: string };

    const existing = await prisma.userRole.findUnique({
      where: { user_id_role: { user_id, role } },
      select: { id: true },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "Role assignment not found" },
        { status: 404 },
      );
    }

    await prisma.userRole.delete({
      where: { user_id_role: { user_id, role } },
    });

    return NextResponse.json({ success: true, revoked: { user_id, role } });
  },
);
