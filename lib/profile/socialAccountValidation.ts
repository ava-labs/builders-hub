export const X_ACCOUNT_PATTERN = /^https?:\/\/(?:www\.)?(?:twitter|x)\.com\/[A-Za-z0-9_]{1,15}\/?$/i;
export const LINKEDIN_ACCOUNT_PATTERN = /^https?:\/\/(?:www\.)?linkedin\.com\/(?:in|pub)\/[\w\-.%]+\/?$/i;
export const GITHUB_ACCOUNT_PATTERN = /^(?:[A-Za-z0-9](?:[A-Za-z0-9]|-(?=[A-Za-z0-9])){0,38}|https?:\/\/(?:www\.)?github\.com\/[A-Za-z0-9](?:[A-Za-z0-9]|-(?=[A-Za-z0-9])){0,38}\/?)$/i;
export const TELEGRAM_ACCOUNT_PATTERN = /^@?[A-Za-z][A-Za-z0-9_]{4,31}$/;

type BasicProfileShape = {
  name?: unknown;
  country?: unknown;
  user_type?: {
    is_student?: unknown;
    is_founder?: unknown;
    is_employee?: unknown;
    is_developer?: unknown;
    is_enthusiast?: unknown;
  } | null;
};

function isNonEmptyString(value: unknown): boolean {
  return typeof value === "string" && value.trim().length > 0;
}

// Matches the BasicProfileSetup zod schema: name + country + at least one
// role flag are required; social handles are optional. Used by
// LoginModalWrapper to decide whether to re-open the basic-setup modal.
export function hasCompleteBasicProfile(
  profile: BasicProfileShape | null | undefined,
): boolean {
  if (!isNonEmptyString(profile?.name)) return false;
  if (!isNonEmptyString(profile?.country)) return false;
  const t = profile?.user_type;
  const hasRole = Boolean(
    t?.is_student ||
      t?.is_founder ||
      t?.is_employee ||
      t?.is_developer ||
      t?.is_enthusiast,
  );
  return hasRole;
}
