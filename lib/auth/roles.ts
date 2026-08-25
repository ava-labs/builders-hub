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

import { Permission, hasPermission } from "./rolePermissions";

export type { Permission };
export { hasPermission };

// ---------------------------------------------------------------------------
// Backward-compatible shortcuts (kept so existing call-sites compile)
// ---------------------------------------------------------------------------

/** @deprecated Use `hasPermission(attrs, { resource: "showcase", action: "read" })` directly. */
export const hasShowcaseRole = (
  customAttributes: readonly string[] | null | undefined,
): boolean => hasPermission(customAttributes, { resource: "showcase", action: "read" });

/** @deprecated Use `hasPermission(attrs, { resource: "event", action: "write" })` directly. */
export const hasHackathonEditorRole = (
  customAttributes: readonly string[] | null | undefined,
): boolean => hasPermission(customAttributes, { resource: "event", action: "write" });

/** @deprecated Use `hasPermission(attrs, { resource: "judge", action: "read" })` directly. */
export const hasJudgeRole = (
  customAttributes: readonly string[] | null | undefined,
): boolean => hasPermission(customAttributes, { resource: "judge", action: "read" });

/** @deprecated Use `hasPermission(attrs, { resource: "notification", action: "write" })` directly. */
export const hasNotificationsRole = (
  customAttributes: readonly string[] | null | undefined,
): boolean => hasPermission(customAttributes, { resource: "notification", action: "write" });

// DB-backed judge/evaluation policies live in ./permissions (single source of
// truth for scoped policies); re-exported here for existing call-sites.
export { isHackathonJudge, canEvaluateHackathon } from "./permissions";

const TEAM1_PREFIX = "team1";

/**
 * Shortcut: user has access to the Team1 Academy area.
 * Grants access to any user whose custom_attributes contain at least one tag
 * starting with `team1` (admin, member, etc.) or the `devrel` tag. Uses prefix
 * matching so newly-introduced team1-scoped tags grant access without needing
 * to be enumerated here.
 */
export function hasTeam1AcademyAccess(
  customAttributes: readonly string[] | null | undefined,
): boolean {
  if (!customAttributes || customAttributes.length === 0) return false;
  return customAttributes.some(
    (a) => a.startsWith(TEAM1_PREFIX) || a === "devrel",
  );
}
