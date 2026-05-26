export const WALLET_TAG_MAX_LENGTH = 50;
export const WALLET_TAG_PATTERN = /^[A-Za-z0-9 _-]+$/;
export const WALLET_TAG_INPUT_PATTERN = "[A-Za-z0-9 _-]*";
export const WALLET_TAG_VALIDATION_MESSAGE =
  "Only alphanumeric characters, spaces, underscores, and hyphens are allowed.";

export function normalizeWalletTag(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const tag = value.trim();
  if (!tag || tag.length > WALLET_TAG_MAX_LENGTH) {
    return undefined;
  }

  return WALLET_TAG_PATTERN.test(tag) ? tag : undefined;
}
