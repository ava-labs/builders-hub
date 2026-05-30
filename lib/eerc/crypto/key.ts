// Ported from @avalabs/ac-eerc-sdk (src/crypto/key.ts).
//
// Derives a BabyJubJub private key from an EIP-191 wallet signature.
// Determinism is critical: the same wallet signing REGISTER_MESSAGE must
// always produce the same BJJ key — otherwise users lose access to their
// encrypted balance on subsequent sessions.

import createBlakeHash from 'blake-hash';
import { sha256 } from 'js-sha256';
import { SHA_256_MAX_DIGEST, SUB_GROUP_ORDER } from './constants';
import { Scalar } from './scalar';

/** Convert a hex-encoded secret into a scalar suitable for BabyJubJub. */
export function formatKeyForCurve(keyHex: string): bigint {
  let hash = (createBlakeHash('blake512') as { update: (b: Buffer) => { digest: () => Buffer } })
    .update(Buffer.from(keyHex, 'hex'))
    .digest()
    .slice(0, 32);

  // Prune the buffer the same way EdDSA/Ed25519 prune their secret scalars:
  // clear low 3 bits + set bit 254 of the little-endian representation.
  const prune = (b: Buffer): Buffer => {
    if (b.length < 32) throw new Error('Buffer must be at least 32 bytes long');
    const out = Buffer.from(b);
    out[0] = (out[0] ?? 0) & 0xf8;
    out[31] = ((out[31] ?? 0) & 0x7f) | 0x40;
    return out;
  };

  const leBufferToBigInt = (b: Buffer): bigint =>
    BigInt(`0x${Buffer.from(b).reverse().toString('hex')}`);

  const pruned = prune(hash);
  const asBig = leBufferToBigInt(pruned);
  return Scalar.shiftRight(asBig, 3) % SUB_GROUP_ORDER;
}

/**
 * Given a 65-byte wallet signature (0x + 130 hex chars), take its `r` component
 * (first 32 bytes) and "grind" it into a scalar of SUB_GROUP_ORDER. Returns a
 * hex string (not 0x-prefixed).
 */
export function getPrivateKeyFromSignature(signature: string): string {
  const fixed = signature.replace(/^0x/, '');
  const r = fixed.slice(0, 64);
  return grindKey(r);
}

function grindKey(seed: string): string {
  const limit = SUB_GROUP_ORDER;
  const maxAllowed = SHA_256_MAX_DIGEST - (SHA_256_MAX_DIGEST % limit);
  let i = 0;
  let key = hashKeyWithIndex(seed, i++);
  while (key >= maxAllowed) {
    key = hashKeyWithIndex(seed, i++);
    if (i > 1000) throw new Error('Could not find a valid key');
  }
  return (key % limit).toString(16);
}

function hashKeyWithIndex(key: string, index: number): bigint {
  const strip = (s: string) => s.replace(/^0x/, '');
  const hex = (n: number) => n.toString(16);
  const pad = (s: string, n: number, ch = '0') => (s.length >= n ? s : ch.repeat(n - s.length) + s);
  const byteAlign = (s: string, size = 8) => {
    const rem = s.length % size;
    return rem ? pad(s, ((s.length - rem) / size) * size + size) : s;
  };

  const input = strip(key) + byteAlign(hex(index), 2);
  const buff = Buffer.from(strip(input), 'hex');
  return BigInt(`0x${sha256.update(new Uint8Array(buff)).hex()}`);
}
