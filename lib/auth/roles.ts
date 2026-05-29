export const ROLE_GROUPS = {
  showcase: ["showcase", "devrel", "admin"],
  hackathonEditor: ["hackathonCreator", "team1-admin", "devrel"],
  hackathonAdmin: ["devrel", "team1-admin"],
  judge: ["devrel", "judge"],
  notifications: ["devrel", "notify_event"],
} as const satisfies Record<string, readonly string[]>;

export type RoleGroupName = keyof typeof ROLE_GROUPS;

export function hasAnyRole(
  customAttributes: readonly string[] | null | undefined,
  allowedRoles: readonly string[],
): boolean {
  if (!customAttributes || customAttributes.length === 0) return false;
  if (allowedRoles.length === 0) return false;
  const owned = new Set(customAttributes);
  return allowedRoles.some((role) => owned.has(role));
}

export function hasRoleGroup(
  customAttributes: readonly string[] | null | undefined,
  group: RoleGroupName,
): boolean {
  return hasAnyRole(customAttributes, ROLE_GROUPS[group]);
}

export const hasShowcaseRole = (
  customAttributes: readonly string[] | null | undefined,
): boolean => hasRoleGroup(customAttributes, "showcase");

export const hasHackathonEditorRole = (
  customAttributes: readonly string[] | null | undefined,
): boolean => hasRoleGroup(customAttributes, "hackathonEditor");

export const hasHackathonAdminRole = (
  customAttributes: readonly string[] | null | undefined,
): boolean => hasRoleGroup(customAttributes, "hackathonAdmin");

export const hasJudgeRole = (
  customAttributes: readonly string[] | null | undefined,
): boolean => hasRoleGroup(customAttributes, "judge");

export const hasNotificationsRole = (
  customAttributes: readonly string[] | null | undefined,
): boolean => hasRoleGroup(customAttributes, "notifications");
