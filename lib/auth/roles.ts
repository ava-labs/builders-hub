/**
 * Role-based access helpers.
 *
 * Authorization is driven by rolePermissions.ts, which maps every role to a
 * list of { resource, action } permissions. This module provides the
 * runtime helpers that evaluate those permissions against a user's roles
 * stored in session.user.custom_attributes.
 *
 * Public API:
 *   hasAnyRole       – low-level role presence check (kept for symmetry).
 *   hasPermission    – preferred: checks resource:action against ROLE_PERMISSIONS.
 *   hasShowcaseRole  – backward-compatible shortcut.
 *   hasHackathonEditorRole, hasJudgeRole, hasNotificationsRole – same.
 *
 * ROLE_GROUPS has been removed. All "who can access X?" rules now live
 * exclusively in rolePermissions.ts → ROLE_PERMISSIONS.
 */

import {
  Permission,
  getPermissionsFromRoles,
  checkPermission,
} from "./rolePermissions";
import { prisma } from "@/prisma/prisma";

export type { Permission };

// ---------------------------------------------------------------------------
// Core helpers
// ---------------------------------------------------------------------------

/**
 * Returns true when the user's roles grant the required { resource, action }.
 *
 * This is the preferred authorization primitive for new code.
 *
 * @example
 * hasPermission(session.user.custom_attributes, { resource: "badge", action: "write" })
 */
export function hasPermission(
  customAttributes: readonly string[] | null | undefined,
  required: Permission,
): boolean {
  if (!customAttributes || customAttributes.length === 0) return false;
  const permissions = getPermissionsFromRoles([...customAttributes]);
  return checkPermission(permissions, required);
}

// ---------------------------------------------------------------------------
// Backward-compatible shortcuts (kept so existing call-sites compile)
// ---------------------------------------------------------------------------

/** @deprecated Use `hasPermission(attrs, { resource: "showcase", action: "read" })` directly. */
export const hasShowcaseRole = (
  customAttributes: readonly string[] | null | undefined,
): boolean => hasPermission(customAttributes, { resource: "showcase", action: "read" });

/** @deprecated Use `hasPermission(attrs, { resource: "hackathon", action: "write" })` directly. */
export const hasHackathonEditorRole = (
  customAttributes: readonly string[] | null | undefined,
): boolean => hasPermission(customAttributes, { resource: "hackathon", action: "write" });

/** @deprecated Use `hasPermission(attrs, { resource: "judge", action: "read" })` directly. */
export const hasJudgeRole = (
  customAttributes: readonly string[] | null | undefined,
): boolean => hasPermission(customAttributes, { resource: "judge", action: "read" });

/** @deprecated Use `hasPermission(attrs, { resource: "notification", action: "write" })` directly. */
export const hasNotificationsRole = (
  customAttributes: readonly string[] | null | undefined,
): boolean => hasPermission(customAttributes, { resource: "notification", action: "write" });

// ---------------------------------------------------------------------------
// Judge helpers (DB-backed)
// ---------------------------------------------------------------------------

/**
 * Returns true when the user has a per-hackathon judge assignment row.
 */
export async function isHackathonJudge(
  userId: string | undefined | null,
  hackathonId: string,
): Promise<boolean> {
  if (!userId) return false;
  const row = await prisma.hackathonJudge.findUnique({
    where: { hackathon_id_user_id: { hackathon_id: hackathonId, user_id: userId } },
    select: { id: true },
  });
  return row !== null;
}

/**
 * Returns true when the user may evaluate projects for the given hackathon:
 * any role with judge:read (devrel, judge) OR an assigned HackathonJudge row.
 */
export async function canEvaluateHackathon(
  session: { user?: { id?: string; custom_attributes?: string[] } } | null | undefined,
  hackathonId: string,
): Promise<boolean> {
  if (!session?.user) return false;
  if (hasPermission(session.user.custom_attributes, { resource: "judge", action: "read" })) return true;
  return isHackathonJudge(session.user.id, hackathonId);
}
