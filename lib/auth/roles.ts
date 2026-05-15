/**
 * Role-based access helpers.
 *
 * The project stores per-user permission tags in `User.custom_attributes`
 * (a `string[]`). Throughout the codebase there are many places that ask
 * "does this user have any of these roles?", and those checks keep being
 * re-implemented with `attrs.includes(...) || attrs.includes(...)` chains
 * that tend to diverge (different roles per site, missing `admin`, etc.).
 *
 * This module centralizes that logic with:
 *  - `hasAnyRole`: generic primitive for any ad-hoc combination.
 *  - `ROLE_GROUPS`: named policies for the combinations that repeat across
 *    the app (showcase, hackathon editor, judge, notifications).
 *  - `hasRoleGroup`: typed shortcut that reads from `ROLE_GROUPS`.
 *  - Thin aliases (e.g. `hasShowcaseRole`) for the most common groups, so
 *    call-sites stay short and readable.
 */

/**
 * Team One hierarchy tags, stored as values inside `custom_attributes`.
 * Treat them as mutually exclusive at the service layer: a user can hold
 * exactly one of these at a time. Membership in a specific Team One country
 * is encoded by `User.team_id` (e.g. `team1-latam`, `team1-india`).
 */
export const TEAM1_HIERARCHY_ROLES = [
  "team1-admin",
  "team1-member",
  "team1-technical",
] as const satisfies readonly string[];
export type Team1Role = (typeof TEAM1_HIERARCHY_ROLES)[number];

/**
 * Named policies for role groups that recur across the codebase.
 * Add a new entry here when a new "who can access X?" rule appears and is
 * used in more than one place.
 */
export const ROLE_GROUPS = {
  /** Access to the /showcase area (includes admin as super-user). */
  showcase: ["showcase", "devrel", "admin"],
  /** Access to hackathon creation/edition flows. */
  hackathonEditor: ["hackathonCreator", "team1-admin", "devrel"],
  /** Access to evaluation/judge screens and APIs. */
  judge: ["devrel", "judge"],
  /** Access to notification sending flows. */
  notifications: ["devrel", "notify_event"],
  /** Who can see the Team One profile tab. */
  team1Tab: ["devrel", "team1-admin"],
  /** Who can mutate Team One membership (assign / remove). */
  team1Edit: ["devrel", "team1-admin"],
  /** Anyone "in" Team One — admins, regular members, and technical. */
  team1Membership: TEAM1_HIERARCHY_ROLES,
} as const satisfies Record<string, readonly string[]>;

export type RoleGroupName = keyof typeof ROLE_GROUPS;

/**
 * Returns true when `customAttributes` contains at least one of the
 * `allowedRoles`. Safe against `null`/`undefined`/empty inputs.
 *
 * Use this when the set of allowed roles is dynamic or intentionally
 * one-off. For recurring policies prefer `hasRoleGroup`.
 */
export function hasAnyRole(
  customAttributes: readonly string[] | null | undefined,
  allowedRoles: readonly string[],
): boolean {
  if (!customAttributes || customAttributes.length === 0) return false;
  if (allowedRoles.length === 0) return false;
  // Set lookup is O(1); worth it when `allowedRoles` is small but
  // `customAttributes` can be longer.
  const owned = new Set(customAttributes);
  return allowedRoles.some((role) => owned.has(role));
}

/**
 * Returns true when `customAttributes` grants access to the given named
 * role group. Prefer this over `hasAnyRole` for recurring policies so the
 * authorization rules live in a single place (`ROLE_GROUPS`).
 */
export function hasRoleGroup(
  customAttributes: readonly string[] | null | undefined,
  group: RoleGroupName,
): boolean {
  return hasAnyRole(customAttributes, ROLE_GROUPS[group]);
}

/** Shortcut: user can access the /showcase area. */
export const hasShowcaseRole = (
  customAttributes: readonly string[] | null | undefined,
): boolean => hasRoleGroup(customAttributes, "showcase");

/** Shortcut: user can create/edit hackathons. */
export const hasHackathonEditorRole = (
  customAttributes: readonly string[] | null | undefined,
): boolean => hasRoleGroup(customAttributes, "hackathonEditor");

/** Shortcut: user can judge/evaluate submissions. */
export const hasJudgeRole = (
  customAttributes: readonly string[] | null | undefined,
): boolean => hasRoleGroup(customAttributes, "judge");

/** Shortcut: user can send notifications. */
export const hasNotificationsRole = (
  customAttributes: readonly string[] | null | undefined,
): boolean => hasRoleGroup(customAttributes, "notifications");

/** Shortcut: user can see the Team One profile tab. */
export const canSeeTeam1Tab = (
  customAttributes: readonly string[] | null | undefined,
): boolean => hasRoleGroup(customAttributes, "team1Tab");

/** Shortcut: user can assign / remove Team One membership. */
export const canEditTeam1 = (
  customAttributes: readonly string[] | null | undefined,
): boolean => hasRoleGroup(customAttributes, "team1Edit");
