import { describe, expect, it } from 'vitest';

import {
  BLS_PROOF_OF_POSSESSION_REGEX,
  BLS_PUBLIC_KEY_REGEX,
  sanitizeCredentialInput,
  validateManagedNodeCredentials,
  validateNodeCredentials,
} from '@/components/toolbox/components/ValidatorListInput/nodeCredentials';

// 96 hex chars ending in '8' — mirrors the production incident where the pasted
// key's trailing quote produced noble's `non-hex character "8"" at index 96`.
const PUBLIC_KEY = `0x${'ab'.repeat(47)}a8`;
const PROOF = `0x${'cd'.repeat(96)}`;
const NODE_ID = 'NodeID-7Xhw2mDxuDS44j42TCB6U5579esbSt3Lg';

describe('sanitizeCredentialInput', () => {
  it('strips the trailing quote from a terminal drag-copy', () => {
    expect(sanitizeCredentialInput(`${PUBLIC_KEY}"`)).toBe(PUBLIC_KEY);
  });

  it('strips wrapping quotes, commas, semicolons, and whitespace', () => {
    expect(sanitizeCredentialInput(`  "${PUBLIC_KEY}",\n`)).toBe(PUBLIC_KEY);
    expect(sanitizeCredentialInput(`'${NODE_ID}';`)).toBe(NODE_ID);
  });

  it('leaves interior characters untouched', () => {
    expect(sanitizeCredentialInput('0xab cd')).toBe('0xab cd');
  });

  it('returns oversized pastes unchanged instead of scanning them', () => {
    // Guards against the quadratic trailing-junk scan on multi-KB garbage pastes.
    const oversized = `0x${' '.repeat(50_000)}x`;
    expect(sanitizeCredentialInput(oversized)).toBe(oversized);
  });

  it('turns non-string values into empty strings instead of throwing', () => {
    // The JSON tab feeds values straight off JSON.parse, so numbers can arrive here.
    expect(sanitizeCredentialInput(123 as unknown as string)).toBe('');
    expect(sanitizeCredentialInput(null as unknown as string)).toBe('');
  });
});

describe('BLS regexes', () => {
  it('accepts exact-length hex only', () => {
    expect(BLS_PUBLIC_KEY_REGEX.test(PUBLIC_KEY)).toBe(true);
    expect(BLS_PUBLIC_KEY_REGEX.test(PUBLIC_KEY.slice(0, -1))).toBe(false);
    expect(BLS_PUBLIC_KEY_REGEX.test(`${PUBLIC_KEY}f`)).toBe(false);
    expect(BLS_PROOF_OF_POSSESSION_REGEX.test(PROOF)).toBe(true);
    expect(BLS_PROOF_OF_POSSESSION_REGEX.test(PROOF.slice(0, -1))).toBe(false);
    expect(BLS_PROOF_OF_POSSESSION_REGEX.test(`${PROOF}0`)).toBe(false);
  });
});

describe('validateNodeCredentials', () => {
  it('regression: accepts the exact paste that broke the stake page (trailing quote)', () => {
    const result = validateNodeCredentials({
      nodeID: NODE_ID,
      publicKey: `${PUBLIC_KEY}"`,
      proofOfPossession: PROOF,
    });
    expect(result).toEqual({
      ok: true,
      value: { nodeID: NODE_ID, publicKey: PUBLIC_KEY, proofOfPossession: PROOF },
    });
  });

  it('accepts clean values unchanged', () => {
    const result = validateNodeCredentials({
      nodeID: NODE_ID,
      publicKey: PUBLIC_KEY,
      proofOfPossession: PROOF,
    });
    expect(result).toEqual({
      ok: true,
      value: { nodeID: NODE_ID, publicKey: PUBLIC_KEY, proofOfPossession: PROOF },
    });
  });

  it('accepts a NodeID pasted with wrapping quotes', () => {
    const result = validateNodeCredentials({
      nodeID: `"${NODE_ID}"`,
      publicKey: PUBLIC_KEY,
      proofOfPossession: PROOF,
    });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.nodeID).toBe(NODE_ID);
  });

  it('rejects a public key with the wrong length, reporting the hex length', () => {
    const result = validateNodeCredentials({
      nodeID: NODE_ID,
      publicKey: PUBLIC_KEY.slice(0, -1),
      proofOfPossession: PROOF,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toMatch(/96 hex characters/);
      expect(result.error).toMatch(/got 95/);
    }
  });

  it('rejects a public key with non-hex characters', () => {
    const result = validateNodeCredentials({
      nodeID: NODE_ID,
      publicKey: `0x${'zz'.repeat(48)}`,
      proofOfPossession: PROOF,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/non-hex/);
  });

  it('rejects a public key without the 0x prefix', () => {
    const result = validateNodeCredentials({
      nodeID: NODE_ID,
      publicKey: PUBLIC_KEY.slice(2),
      proofOfPossession: PROOF,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/start with 0x/);
  });

  it('rejects a proof of possession with the wrong length', () => {
    const short = validateNodeCredentials({
      nodeID: NODE_ID,
      publicKey: PUBLIC_KEY,
      proofOfPossession: PROOF.slice(0, -1),
    });
    expect(short.ok).toBe(false);
    if (!short.ok) {
      expect(short.error).toMatch(/192 hex characters/);
      expect(short.error).toMatch(/got 191/);
    }

    const long = validateNodeCredentials({
      nodeID: NODE_ID,
      publicKey: PUBLIC_KEY,
      proofOfPossession: `${PROOF}00`,
    });
    expect(long.ok).toBe(false);
    if (!long.ok) expect(long.error).toMatch(/got 194/);
  });

  it('rejects a NodeID without the NodeID- prefix', () => {
    const result = validateNodeCredentials({
      nodeID: NODE_ID.replace('NodeID-', ''),
      publicKey: PUBLIC_KEY,
      proofOfPossession: PROOF,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/NodeID/);
  });

  it('rejects a NodeID with a tampered checksum', () => {
    const result = validateNodeCredentials({
      nodeID: `${NODE_ID.slice(0, -1)}h`,
      publicKey: PUBLIC_KEY,
      proofOfPossession: PROOF,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/NodeID/);
  });

  it('rejects a NodeID with invalid base58 characters', () => {
    const result = validateNodeCredentials({
      nodeID: 'NodeID-0OIl0OIl0OIl0OIl0OIl0OIl0OIl0OIl0',
      publicKey: PUBLIC_KEY,
      proofOfPossession: PROOF,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/NodeID/);
  });

  it('rejects non-string JSON values with a friendly error instead of throwing', () => {
    const result = validateNodeCredentials({
      nodeID: NODE_ID,
      publicKey: 123 as unknown as string,
      proofOfPossession: PROOF,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/BLS public key/);
  });

  it('rejects an absurdly long NodeID without decoding it', () => {
    const result = validateNodeCredentials({
      nodeID: `NodeID-${'1'.repeat(100)}`,
      publicKey: PUBLIC_KEY,
      proofOfPossession: PROOF,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/NodeID/);
  });
});

describe('validateManagedNodeCredentials', () => {
  it('accepts a managed node without BLS info, sanitizing the NodeID', () => {
    const result = validateManagedNodeCredentials({
      nodeID: ` ${NODE_ID} `,
      publicKey: '',
      proofOfPossession: '',
    });
    expect(result).toEqual({
      ok: true,
      value: { nodeID: NODE_ID, publicKey: '', proofOfPossession: '' },
    });
  });

  it('rejects a BLS-less managed node when the NodeID is invalid', () => {
    const result = validateManagedNodeCredentials({
      nodeID: `${NODE_ID.slice(0, -1)}h`,
      publicKey: '',
      proofOfPossession: '',
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/NodeID/);
  });

  it('fully validates when BLS info is present', () => {
    const sanitized = validateManagedNodeCredentials({
      nodeID: NODE_ID,
      publicKey: `${PUBLIC_KEY}"`,
      proofOfPossession: PROOF,
    });
    expect(sanitized).toEqual({
      ok: true,
      value: { nodeID: NODE_ID, publicKey: PUBLIC_KEY, proofOfPossession: PROOF },
    });

    const bad = validateManagedNodeCredentials({
      nodeID: NODE_ID,
      publicKey: PUBLIC_KEY.slice(0, -1),
      proofOfPossession: PROOF,
    });
    expect(bad.ok).toBe(false);
  });

  it('rejects half-present BLS info', () => {
    const result = validateManagedNodeCredentials({
      nodeID: NODE_ID,
      publicKey: PUBLIC_KEY,
      proofOfPossession: '',
    });
    expect(result.ok).toBe(false);
  });
});
