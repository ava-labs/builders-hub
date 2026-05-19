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

export type { Permission };

// ---------------------------------------------------------------------------
// Core helpers
// ---------------------------------------------------------------------------

/**
 * Returns true when `customAttributes` contains at least one of the
 * `allowedRoles`.
 *
 * superadmin and devrel always return true (wildcard roles).
 */
export function hasAnyRole(
  customAttributes: readonly string[] | null | undefined,
  allowedRoles: readonly string[],
): boolean {
  if (!customAttributes || customAttributes.length === 0) return false;
  if (allowedRoles.length === 0) return false;
  const owned = new Set(customAttributes);
  if (owned.has("superadmin") || owned.has("devrel")) return true;
  return allowedRoles.some((role) => owned.has(role));
}

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

/** Shortcut: user can access the /showcase area. */
export const hasShowcaseRole = (
  customAttributes: readonly string[] | null | undefined,
): boolean => hasPermission(customAttributes, { resource: "showcase", action: "read" });

/** Shortcut: user can create/edit hackathons. */
export const hasHackathonEditorRole = (
  customAttributes: readonly string[] | null | undefined,
): boolean => hasPermission(customAttributes, { resource: "hackathon", action: "write" });

/** Shortcut: user can judge/evaluate submissions. */
export const hasJudgeRole = (
  customAttributes: readonly string[] | null | undefined,
): boolean => hasPermission(customAttributes, { resource: "judge", action: "read" });

/** Shortcut: user can send notifications. */
export const hasNotificationsRole = (
  customAttributes: readonly string[] | null | undefined,
): boolean => hasPermission(customAttributes, { resource: "notification", action: "write" });
