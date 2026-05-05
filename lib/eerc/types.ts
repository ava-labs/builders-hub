// Canonical TypeScript types for the Encrypted ERC (eERC) protocol.
// Mirrors the on-chain struct shapes from ava-labs/EncryptedERC and the
// off-chain proof payload shapes used by the client-side prover.
//
// The protocol encrypts balances as ElGamal ciphertexts on the BabyJubJub
// curve (EGCT = ElGamal Ciphertext), and encrypts per-tx audit information
// as Poseidon ciphertexts (PCT).

export type Hex = `0x${string}`;

/** A point on the BabyJubJub curve, matching the Solidity `Point` struct. */
export interface Point {
  x: bigint;
  y: bigint;
}

/**
 * ElGamal ciphertext on BabyJubJub. Encrypts a user's encrypted balance or
 * an amount attached to a mint / transfer / withdraw.
 */
export interface EGCT {
  c1: Point;
  c2: Point;
}

/**
 * Groth16 proof points for a Solidity verifier contract.
 * Matches the `(a, b, c)` shape produced by snarkjs → Solidity glue.
 */
export interface ProofPoints {
  a: [bigint, bigint];
  b: [[bigint, bigint], [bigint, bigint]];
  c: [bigint, bigint];
}

/** One of the five circuit kinds — used to pick the right wasm/zkey. */
export type CircuitKind = 'registration' | 'mint' | 'transfer' | 'withdraw' | 'burn';

/** The two deployment modes for the EncryptedERC contract. */
export type EERCMode = 'standalone' | 'converter';

export interface ERC20Meta {
  address: Hex;
  symbol: string;
  name: string;
  decimals: number;
}

export interface EERCDeployment {
  label: string;
  encryptedERC: Hex;
  registrar: Hex;
  babyJubJubLibrary: Hex;
  verifiers: {
    registration: Hex;
    mint: Hex;
    transfer: Hex;
    withdraw: Hex;
    burn: Hex;
  };
  auditorAddress: Hex;
  /** eERC native decimals — always 2 in the canonical protocol (see EncryptedERC/scripts/constants.ts). */
  decimals: number;
  deployedAtBlock: number;
  /** Only set for converter mode. */
  supportedTokens?: ERC20Meta[];
}

export interface EERCDeploymentsFile {
  deployments: Record<string, {
    chainName: string;
    standalone?: EERCDeployment;
    converter?: EERCDeployment;
  }>;
}

/** What we persist locally for a user's registered BJJ identity. */
export interface EERCIdentity {
  /** User's EVM address. */
  address: Hex;
  /** BabyJubJub private key (scalar in the subgroup order). */
  privateKey: bigint;
  /** BabyJubJub public key = privateKey * BASE. */
  publicKey: Point;
  /** Chain ID this registration is bound to. */
  chainId: number;
  /** Registrar contract address the registration was submitted to. */
  registrar: Hex;
}

/** A decrypted transaction for the Balance & History view. */
export interface DecryptedEntry {
  kind: 'deposit' | 'mint' | 'transfer-in' | 'transfer-out' | 'withdraw' | 'burn';
  amount: bigint;
  counterparty?: Hex;
  txHash: Hex;
  blockNumber: number;
  timestamp: number;
  /** Optional encrypted note attached by the sender. */
  note?: string;
}
