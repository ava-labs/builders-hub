// A mock L1 validator for the tier 1 chain tests: a random NodeID and a BLS12-381 key with its proof of possession.
//
// No node runs behind it. Tier 1 keeps the Validator Manager on the Fuji C-Chain, so the Primary Network signs every
// Warp message, and the P-Chain checks only the form of a validator. The Console's JSON tab ('API Response',
// components/toolbox/components/ValidatorListInput/AddValidatorControls.tsx) takes the info.getNodeID response that
// nodeCredentialsJson() writes.
//
// What avalanchego checks (origin/master 5bf881e069, read on 2026-10-04):
// - vms/platformvm/platform/convert_subnet_to_l1_tx.go, ConvertSubnetToL1Validator.Verify: the weight is not 0, the
//   NodeID has 20 bytes and is not empty, and the proof of possession verifies. Any balance above 0 makes the
//   validator active (vms/platformvm/txs/executor/standard_tx_executor.go): there is no minimum balance.
// - vms/platformvm/signer/proof_of_possession.go, ProofOfPossession.Verify: the signed message is the 48-byte
//   compressed public key. The JSON form of both values is 0x hex (formatting.HexNC).
// - utils/crypto/bls: the min-pk scheme. The public key is in G1 (48 bytes compressed); PublicKeyFromCompressedBytes
//   decompresses it and runs KeyValidate (on the curve, in the subgroup, not infinity). The signature is in G2 (96
//   bytes compressed); SignatureFromBytes decompresses it and runs SigValidate. VerifyProofOfPossession hashes to the
//   curve with the ciphersuite PROOF_OF_POSSESSION_DST.
//
// assertPopSchemeMatchesAvalanchego() proves this module signs exactly as avalanchego does: it signs with avalanchego's
// first local-network staker key and compares the result, byte for byte, with the proof that avalanchego's own local
// genesis holds. verifyMockValidator() then checks each new validator with @noble/curves and with avalanchejs, the
// library the Console uses.
//
// The BLS secret key never leaves createMockValidator(): no test step needs it after the proof is made.

import { randomBytes } from 'node:crypto';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { bls12_381 } from '@noble/curves/bls12-381.js';
import { sha256 } from '@noble/hashes/sha2';
import { bls as avalanchejsBls, utils } from '@avalabs/avalanchejs';

type Hex = `0x${string}`;

/** avalanchego bls.CiphersuiteProofOfPossession (utils/crypto/bls/ciphersuite.go). */
export const PROOF_OF_POSSESSION_DST = 'BLS_POP_BLS12381G2_XMD:SHA-256_SSWU_RO_POP_';

const NODE_ID_PREFIX = 'NodeID-';
const NODE_ID_LENGTH = 20;
// The same checks as the Console form (components/toolbox/components/ValidatorListInput/nodeCredentials.ts). The
// Console also takes upper-case hex. This module writes lower case only.
const BLS_PUBLIC_KEY_REGEX = /^0x[0-9a-f]{96}$/;
const BLS_PROOF_OF_POSSESSION_REGEX = /^0x[0-9a-f]{192}$/;

// avalanchego's first local-network staker: staking/local/signer1.key holds these 32 ASCII bytes as the secret key,
// and genesis/genesis_local.json holds its public key and proof of possession. These are public test fixtures of the
// avalanchego repository (every local network uses them). They control no funds on Fuji or mainnet.
const AVALANCHEGO_LOCAL_SIGNER = {
  secretKeyAscii: 'AvalancheLocalNetworkValidator01',
  publicKey: '0x900c9b119b5c82d781d4b49be78c3fc7ae65f2b435b7ed9e3a8b9a03e475edff86d8a64827fec8db23a6f236afbf127d',
  proofOfPossession:
    '0x8bfd6d4d2086b2b8115d8f72f94095fefe5a6c07876b2accf51a811adf520f389e74a3d2152a6d90b521e2be58ffe468043dc5ea68b4c44410eb67f8dc24f13ed4f194000764c0e922cd254a3588a4962b1cb4db7de4bb9cda9d9d4d6b03f3d2',
} as const;

const { longSignatures } = bls12_381;
const encoder = new TextEncoder();

export interface MockValidator {
  /** A name for logs and the ledger, for example 'V0'. */
  label: string;
  /** NodeID-<CB58 of 20 random bytes>, as info.getNodeID writes it. */
  nodeID: string;
  /** The 20 NodeID bytes, as the Validator Manager stores them (getNodeValidationID takes these bytes). */
  nodeIDHex: Hex;
  /** The compressed BLS public key: 0x plus 96 hex characters. */
  publicKey: Hex;
  /** The proof of possession: 0x plus 192 hex characters. */
  proofOfPossession: Hex;
}

export interface MockValidatorOptions {
  /** Default 'mock'. */
  label?: string;
  /**
   * Makes the validator reproducible: the same seed gives the same NodeID and BLS key. Without a seed, both come
   * from crypto.randomBytes. A seed is not a secret: the mock validator controls no funds.
   */
  seed?: string | Uint8Array;
}

const toHex = (bytes: Uint8Array): Hex => `0x${Buffer.from(bytes).toString('hex')}`;
const fromHex = (hex: string): Uint8Array => Uint8Array.from(Buffer.from(hex.replace(/^0x/, ''), 'hex'));

/** The proof of possession of a compressed public key, signed with @noble/curves as avalanchego signs it. */
function signProofOfPossession(publicKeyBytes: Uint8Array, secretKey: Uint8Array): Uint8Array {
  const message = longSignatures.hash(publicKeyBytes, PROOF_OF_POSSESSION_DST);
  return longSignatures.Signature.toBytes(longSignatures.sign(message, secretKey));
}

let schemeChecked = false;

/**
 * Throws when this module or avalanchejs would sign a proof of possession that differs from avalanchego's. It signs
 * with avalanchego's local staker key (AVALANCHEGO_LOCAL_SIGNER) through @noble/curves and through avalanchejs, and
 * compares both results with the proof in avalanchego's local genesis. BLS signatures are deterministic, so the
 * bytes must be equal. The check runs once per process; createMockValidator() calls it.
 */
export function assertPopSchemeMatchesAvalanchego(): void {
  if (schemeChecked) return;
  const secretKey = encoder.encode(AVALANCHEGO_LOCAL_SIGNER.secretKeyAscii);
  const publicKey = longSignatures.getPublicKey(secretKey).toBytes(true);
  if (toHex(publicKey) !== AVALANCHEGO_LOCAL_SIGNER.publicKey) {
    throw new Error('@noble/curves derives a different BLS public key than avalanchego for its local signer 1.');
  }
  if (toHex(signProofOfPossession(publicKey, secretKey)) !== AVALANCHEGO_LOCAL_SIGNER.proofOfPossession) {
    throw new Error('@noble/curves signs a different proof of possession than avalanchego for its local signer 1.');
  }
  const avalanchejsProof = avalanchejsBls.signProofOfPossession(
    publicKey,
    avalanchejsBls.secretKeyFromBytes(secretKey),
  );
  if (toHex(avalanchejsProof) !== AVALANCHEGO_LOCAL_SIGNER.proofOfPossession) {
    throw new Error('avalanchejs signs a different proof of possession than avalanchego for its local signer 1.');
  }
  schemeChecked = true;
}

/** sha256(label || seed), so the NodeID and the BLS seed come from the same seed but never share bytes. */
function derive(label: string, seed: Uint8Array): Uint8Array {
  const tag = encoder.encode(`e2e-chain mock validator ${label}`);
  const input = new Uint8Array(tag.length + seed.length);
  input.set(tag);
  input.set(seed, tag.length);
  return sha256(input);
}

function seedBytes(seed: string | Uint8Array): Uint8Array {
  return typeof seed === 'string' ? encoder.encode(seed) : seed;
}

/** NodeID-<CB58>: base58 of the bytes and the last 4 bytes of their sha256 (avalanchejs utils.base58check). */
export function encodeNodeID(bytes: Uint8Array): string {
  if (bytes.length !== NODE_ID_LENGTH) throw new Error(`A NodeID has ${NODE_ID_LENGTH} bytes, not ${bytes.length}.`);
  return `${NODE_ID_PREFIX}${utils.base58check.encode(bytes)}`;
}

/**
 * Makes a mock validator. The BLS secret key is a random scalar mod r (noble's keygen, which takes 48 bytes of
 * seed). avalanchego makes its keys with blst.KeyGen, but the P-Chain checks only the public key and the proof, never
 * how the key was made.
 */
export function createMockValidator(options: MockValidatorOptions = {}): MockValidator {
  assertPopSchemeMatchesAvalanchego();
  const label = options.label ?? 'mock';
  const seed = options.seed === undefined ? undefined : seedBytes(options.seed);

  const blsSeed = seed
    ? Uint8Array.from([...derive('bls 0', seed), ...derive('bls 1', seed)]).subarray(0, 48)
    : randomBytes(48);
  const nodeIdBytes = seed ? derive('node id', seed).subarray(0, NODE_ID_LENGTH) : randomBytes(NODE_ID_LENGTH);
  // avalanchego refuses the empty NodeID (ConvertSubnetToL1Validator.Verify). The chance is 2^-160; check anyway.
  if (nodeIdBytes.every((b) => b === 0)) throw new Error('The NodeID bytes are all zero. Make the validator again.');

  const { secretKey, publicKey } = longSignatures.keygen(Uint8Array.from(blsSeed));
  const publicKeyBytes = publicKey.toBytes(true);
  const proof = signProofOfPossession(publicKeyBytes, secretKey);
  secretKey.fill(0);

  const validator: MockValidator = {
    label,
    nodeID: encodeNodeID(Uint8Array.from(nodeIdBytes)),
    nodeIDHex: toHex(nodeIdBytes),
    publicKey: toHex(publicKeyBytes),
    proofOfPossession: toHex(proof),
  };
  verifyMockValidator(validator);
  return validator;
}

/**
 * The info.getNodeID response for this validator: the text to fill into the JSON field of the 'API Response' tab on
 * the Convert to L1 and Initiate Validator Registration steps. AddValidatorControls.tsx (handleAddFromJson) reads
 * result.nodeID and result.nodePOP, and nodeCredentials.ts checks them.
 */
export function nodeCredentialsJson(validator: MockValidator): string {
  return JSON.stringify({
    jsonrpc: '2.0',
    result: {
      nodeID: validator.nodeID,
      nodePOP: { publicKey: validator.publicKey, proofOfPossession: validator.proofOfPossession },
    },
    id: 1,
  });
}

/**
 * Throws when the Console form or the P-Chain would refuse the validator. It checks the form rules of
 * nodeCredentials.ts, then the proof of possession twice: with @noble/curves 2 (the path avalanchego takes: decode
 * and check both points, then verify over the compressed public key with the PoP ciphersuite), and with avalanchejs
 * (its own @noble/curves 1 copy). noble also refuses a signature at infinity, which SigValidate(false) lets through;
 * a real proof is never at infinity, so the check is stricter than avalanchego and never looser.
 */
export function verifyMockValidator(validator: MockValidator): void {
  const { nodeID, nodeIDHex, publicKey, proofOfPossession } = validator;

  if (!nodeID.startsWith(NODE_ID_PREFIX)) throw new Error(`${validator.label}: the NodeID has no ${NODE_ID_PREFIX}.`);
  const encoded = nodeID.slice(NODE_ID_PREFIX.length);
  const payload = utils.base58check.decode(encoded);
  if (payload.length !== NODE_ID_LENGTH || utils.base58check.encode(payload) !== encoded) {
    throw new Error(`${validator.label}: the NodeID is not CB58 of ${NODE_ID_LENGTH} bytes.`);
  }
  if (toHex(payload) !== nodeIDHex.toLowerCase()) {
    throw new Error(`${validator.label}: nodeIDHex does not match the NodeID.`);
  }
  if (!BLS_PUBLIC_KEY_REGEX.test(publicKey)) throw new Error(`${validator.label}: the public key is not 48 bytes.`);
  if (!BLS_PROOF_OF_POSSESSION_REGEX.test(proofOfPossession)) {
    throw new Error(`${validator.label}: the proof of possession is not 96 bytes.`);
  }

  const publicKeyBytes = fromHex(publicKey);
  const signatureBytes = fromHex(proofOfPossession);

  // bls.PublicKeyFromCompressedBytes: Uncompress, then KeyValidate (on the curve, in the subgroup, not infinity).
  const point = bls12_381.G1.Point.fromBytes(publicKeyBytes);
  point.assertValidity();
  if (point.is0()) throw new Error(`${validator.label}: the public key is the point at infinity.`);
  // bls.SignatureFromBytes: Uncompress, then SigValidate (on the curve, in the subgroup).
  const signature = longSignatures.Signature.fromBytes(signatureBytes);
  signature.assertValidity();
  // bls.VerifyProofOfPossession: the message is the compressed public key.
  const message = longSignatures.hash(publicKeyBytes, PROOF_OF_POSSESSION_DST);
  if (!longSignatures.verify(signature, message, point)) {
    throw new Error(`${validator.label}: @noble/curves refuses the proof of possession.`);
  }

  const verified = avalanchejsBls.verifyProofOfPossession(
    avalanchejsBls.publicKeyFromBytes(publicKeyBytes),
    avalanchejsBls.signatureFromBytes(signatureBytes),
    publicKeyBytes,
  );
  if (!verified) throw new Error(`${validator.label}: avalanchejs refuses the proof of possession.`);
}

// CLI, run from tests/e2e: node chain/lib/mock-validator.ts [seed]
// Checks the scheme against avalanchego's local genesis, makes one validator and prints its info.getNodeID response.
// It prints public values only: the BLS secret key never leaves createMockValidator().
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const seed = process.argv[2];
  assertPopSchemeMatchesAvalanchego();
  console.log('The proof of possession scheme matches avalanchego (local signer 1, @noble/curves and avalanchejs).');
  console.log(nodeCredentialsJson(createMockValidator({ label: 'cli', ...(seed !== undefined && { seed }) })));
}
