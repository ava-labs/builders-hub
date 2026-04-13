/** Matches a basic email address pattern. */
export const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Matches an Avalanche NodeID (base58 encoded, 33-60 chars). */
export const NODE_ID_REGEX = /^NodeID-[A-HJ-NP-Za-km-z1-9]{33,60}$/;

/** Matches an EVM address (0x + 40 hex chars). */
export const EVM_ADDRESS_REGEX = /^0x[a-fA-F0-9]{40}$/;

/** Matches an EVM transaction hash (0x + 64 hex chars). */
export const TX_HASH_REGEX = /^0x[a-fA-F0-9]{64}$/;

/** Default number of items per page when not specified. */
export const DEFAULT_PAGE_SIZE = 12;

/** Maximum allowed page size to prevent excessive queries. */
export const MAX_PAGE_SIZE = 100;
