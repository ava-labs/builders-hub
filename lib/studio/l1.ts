import { base58 } from '@scure/base';
import { bytesToHex, hexToBytes, sha256, type Hex } from 'viem';

/** Decodes an Avalanche CB58 id (base58 with a 4-byte sha256 checksum) to 0x-hex, verifying the checksum. */
export function cb58ToHex(id: string): Hex | null {
  let bytes: Uint8Array;
  try {
    bytes = base58.decode(id);
  } catch {
    return null;
  }
  if (bytes.length < 5) return null;
  const payload = bytes.subarray(0, bytes.length - 4);
  const checksum = bytes.subarray(bytes.length - 4);
  const digest = sha256(payload, 'bytes');
  for (let i = 0; i < 4; i++) if (digest[digest.length - 4 + i] !== checksum[i]) return null;
  return bytesToHex(payload);
}

function bytesToCb58(payload: Uint8Array): string {
  const checksum = sha256(payload, 'bytes').subarray(-4);
  const bytes = new Uint8Array(payload.length + 4);
  bytes.set(payload);
  bytes.set(checksum, payload.length);
  return base58.encode(bytes);
}

/** Encodes a 32-byte id the way Avalanche prints it: base58 with a 4-byte sha256 checksum. */
export function hexToCb58(hex: string): string | null {
  if (!/^0x[0-9a-fA-F]{64}$/.test(hex)) return null;
  return bytesToCb58(hexToBytes(hex as Hex));
}

/** A 20-byte node id as the P-Chain's JSON encoding returns it, printed the way avalanchego does. */
export function nodeIdFromHex(hex: string): string | null {
  if (!/^0x[0-9a-fA-F]{40}$/.test(hex)) return null;
  return `NodeID-${bytesToCb58(hexToBytes(hex as Hex))}`;
}

/** A blockchain id in CB58, whichever form it came in. The L1 catalog stores most as hex. */
export function toCb58Id(id: string): string | null {
  return id.startsWith('0x') ? hexToCb58(id) : cb58ToHex(id) ? id : null;
}
