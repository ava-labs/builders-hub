export const X_ACCOUNT_PATTERN = /^https?:\/\/(?:www\.)?(?:twitter|x)\.com\/[A-Za-z0-9_]{1,15}\/?$/i;
export const LINKEDIN_ACCOUNT_PATTERN = /^https?:\/\/(?:www\.)?linkedin\.com\/(?:in|pub)\/[\w\-.%]+\/?$/i;
export const GITHUB_ACCOUNT_PATTERN = /^(?:[A-Za-z0-9](?:[A-Za-z0-9]|-(?=[A-Za-z0-9])){0,38}|https?:\/\/(?:www\.)?github\.com\/[A-Za-z0-9](?:[A-Za-z0-9]|-(?=[A-Za-z0-9])){0,38}\/?)$/i;
export const TELEGRAM_ACCOUNT_PATTERN = /^@?[A-Za-z][A-Za-z0-9_]{4,31}$/;

type RequiredProfileAccounts = {
  github_account?: unknown;
  x_account?: unknown;
  linkedin_account?: unknown;
  telegram_user?: unknown;
};

function isValidAccountValue(value: unknown, pattern: RegExp): boolean {
  return typeof value === "string" && pattern.test(value.trim());
}

export function hasCompleteRequiredProfileAccounts(
  profile: RequiredProfileAccounts | null | undefined
): boolean {
  return (
    isValidAccountValue(profile?.github_account, GITHUB_ACCOUNT_PATTERN) &&
    isValidAccountValue(profile?.x_account, X_ACCOUNT_PATTERN) &&
    isValidAccountValue(profile?.linkedin_account, LINKEDIN_ACCOUNT_PATTERN) &&
    isValidAccountValue(profile?.telegram_user, TELEGRAM_ACCOUNT_PATTERN)
  );
}
