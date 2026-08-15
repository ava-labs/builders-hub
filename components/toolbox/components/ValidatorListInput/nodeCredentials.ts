import { utils } from '@avalabs/avalanchejs';

// Pasted node credentials routinely arrive wrapped in JSON punctuation (a terminal
// drag-copy of info.getNodeID output grabs the closing quote). A stray trailing quote
// on the BLS public key is exactly what avalanchejs' hexToBuffer turns into the cryptic
// `hex string expected, got non-hex character "8"" at index 96` seen on the stake page.
const LEADING_JUNK = /^[\s"',;]+/;
const TRAILING_JUNK = /[\s"',;]+$/;
// A real credential is at most 194 chars (0x plus 192 hex). The trailing-junk scan is
// quadratic on multi-KB garbage, so oversized pastes skip sanitizing and fail validation.
const MAX_SANITIZE_LENGTH = 256;

export function sanitizeCredentialInput(raw: string): string {
  // The JSON tab feeds values straight off JSON.parse, so non-strings can arrive at runtime.
  if (typeof raw !== 'string') return '';
  if (raw.length > MAX_SANITIZE_LENGTH) return raw;
  return raw.replace(LEADING_JUNK, '').replace(TRAILING_JUNK, '');
}

export const BLS_PUBLIC_KEY_REGEX = /^0x[0-9a-fA-F]{96}$/;
export const BLS_PROOF_OF_POSSESSION_REGEX = /^0x[0-9a-fA-F]{192}$/;

export interface NodeCredentials {
  nodeID: string;
  publicKey: string;
  proofOfPossession: string;
}

export type NodeCredentialsResult = { ok: true; value: NodeCredentials } | { ok: false; error: string };

const NODE_ID_PREFIX = 'NodeID-';

function isValidNodeID(nodeID: string): boolean {
  if (!nodeID.startsWith(NODE_ID_PREFIX)) return false;
  const encoded = nodeID.slice(NODE_ID_PREFIX.length);
  // Real NodeIDs are ~33 base58 chars; base58 decoding is quadratic, so bound the input.
  if (encoded.length === 0 || encoded.length > 64) return false;
  try {
    // base58check.decode strips the 4-byte CB58 checksum without verifying it,
    // so re-encode the payload and compare to catch corrupted pastes.
    const payload = utils.base58check.decode(encoded);
    return payload.length === 20 && utils.base58check.encode(payload) === encoded;
  } catch {
    return false;
  }
}

const INVALID_NODE_ID_ERROR =
  'Invalid NodeID: expected "NodeID-" followed by a valid CB58 string. Re-copy the full value from your node\'s info.getNodeID response.';

function describeHexIssue(value: string, expectedHexChars: number): string {
  if (!value.startsWith('0x')) return 'the value does not start with 0x';
  const hexLength = value.length - 2;
  if (hexLength !== expectedHexChars) return `got ${hexLength}`;
  return 'it contains non-hex characters';
}

export function validateNodeCredentials(input: NodeCredentials): NodeCredentialsResult {
  const nodeID = sanitizeCredentialInput(input.nodeID);
  const publicKey = sanitizeCredentialInput(input.publicKey);
  const proofOfPossession = sanitizeCredentialInput(input.proofOfPossession);

  if (!isValidNodeID(nodeID)) {
    return { ok: false, error: INVALID_NODE_ID_ERROR };
  }

  if (!BLS_PUBLIC_KEY_REGEX.test(publicKey)) {
    return {
      ok: false,
      error: `Invalid BLS public key: expected 0x plus 96 hex characters (48 bytes), but ${describeHexIssue(
        publicKey,
        96,
      )}. Check for missing or extra characters in the paste.`,
    };
  }

  if (!BLS_PROOF_OF_POSSESSION_REGEX.test(proofOfPossession)) {
    return {
      ok: false,
      error: `Invalid BLS proof of possession: expected 0x plus 192 hex characters (96 bytes), but ${describeHexIssue(
        proofOfPossession,
        192,
      )}. Check for missing or extra characters in the paste.`,
    };
  }

  return { ok: true, value: { nodeID, publicKey, proofOfPossession } };
}

// Managed testnet nodes may legitimately omit BLS info (the UI points users to the other
// tabs for those); the NodeID is still validated. Half-present BLS info is invalid.
export function validateManagedNodeCredentials(input: NodeCredentials): NodeCredentialsResult {
  if (!input.publicKey && !input.proofOfPossession) {
    const nodeID = sanitizeCredentialInput(input.nodeID);
    if (!isValidNodeID(nodeID)) {
      return { ok: false, error: INVALID_NODE_ID_ERROR };
    }
    return { ok: true, value: { nodeID, publicKey: '', proofOfPossession: '' } };
  }
  return validateNodeCredentials(input);
}
