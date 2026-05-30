// Ported from @avalabs/ac-eerc-sdk (src/utils/constants.ts) with the SDK's
// React hooks and wagmi-v1 peer dep stripped. The crypto constants themselves
// are protocol-defined — do not mutate.

/** The scalar field modulus of the alt_bn128 / BN254 curve. */
export const SNARK_FIELD_SIZE =
  21888242871839275222246405745257275088548364400416034343698204186575808495617n;

export const SHA_256_MAX_DIGEST =
  115792089237316195423570985008687907853269984665640564039457584007913129639936n;

/**
 * Order of the prime-order subgroup of BabyJubJub. Private keys live in
 * the interval [0, SUB_GROUP_ORDER).
 */
export const SUB_GROUP_ORDER =
  2736030358979909402780800718157159386076813972158567259200215660948447373041n;

/**
 * The deterministic message users sign to derive their BabyJubJub identity.
 * MUST match the SDK's REGISTER message byte-for-byte, otherwise the same
 * wallet produces different BJJ keys on this app vs. other eERC front-ends.
 */
export const REGISTER_MESSAGE = (user: `0x${string}`) =>
  `eERC\nRegistering user with\n Address:${user.toLowerCase()}`;

/** Sentinel user address that receives "burned" tokens in standalone mode. */
export const BURN_USER = {
  address: '0x1111111111111111111111111111111111111111' as const,
  publicKey: [0n, 1n] as [bigint, bigint],
};
