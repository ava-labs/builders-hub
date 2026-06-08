export const WALLET_TAG_OPTIONS = ["dev", "mainnet"] as const;
export type WalletTag = (typeof WALLET_TAG_OPTIONS)[number];

export const WALLET_TAG_MAX_LENGTH = 50;
export const WALLET_TAG_PATTERN = /^(dev|mainnet)$/;
export const WALLET_TAG_VALIDATION_MESSAGE =
  "Wallet tag must be either dev or mainnet.";

export function normalizeWalletTag(value: unknown): WalletTag | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const tag = value.trim();
  if (!tag || tag.length > WALLET_TAG_MAX_LENGTH) {
    return undefined;
  }

  return WALLET_TAG_PATTERN.test(tag) ? (tag as WalletTag) : undefined;
}
