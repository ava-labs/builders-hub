/**
 * Shared EIP-712 constants for wallet ownership proof.
 *
 * The domain and message types are used on both the client (for signing) and
 * the server (for verification). Keeping them here ensures they stay in sync.
 *
 * - Client: use EIP712_TYPES_FOR_SIGNING (eth_signTypedData_v4 requires EIP712Domain)
 * - Server: use EIP712_TYPES_FOR_VERIFY  (viem derives EIP712Domain from `domain` param)
 */

export const EIP712_DOMAIN = {
  name: "Avalanche Builder Hub",
  version: "2",
} as const;

const EIP712_WALLET_OWNERSHIP_FIELDS = [
  { name: "statement", type: "string" },
  { name: "userId", type: "string" },
  { name: "walletAddress", type: "address" },
  { name: "issuedAt", type: "string" },
  { name: "nonce", type: "string" },
] as const;

/** Types for use with eth_signTypedData_v4 — EIP712Domain must be declared explicitly. */
export const EIP712_TYPES_FOR_SIGNING = {
  EIP712Domain: [
    { name: "name", type: "string" },
    { name: "version", type: "string" },
  ],
  WalletOwnership: EIP712_WALLET_OWNERSHIP_FIELDS,
} as const;

/** Types for use with viem's verifyTypedData — it derives EIP712Domain internally. */
export const EIP712_TYPES_FOR_VERIFY = {
  WalletOwnership: EIP712_WALLET_OWNERSHIP_FIELDS,
} as const;

export const EIP712_STATEMENT =
  "I confirm ownership of this wallet and authorize linking it to my Avalanche Builder Hub profile.";

/** Max age of a wallet ownership proof before it is rejected server-side. */
export const PROOF_MAX_AGE_MS = 10 * 60 * 1000;
