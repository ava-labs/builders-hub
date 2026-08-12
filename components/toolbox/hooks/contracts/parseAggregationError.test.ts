import { describe, expect, it } from 'vitest';
import { parseAggregationError } from './parseAggregationError';

describe('parseAggregationError', () => {
  it('maps a below-quorum error with the achieved percentage and remediation links', () => {
    const mapped = parseAggregationError(new Error('signature weight is insufficient: 67*200 > 100*100'));
    expect(mapped).not.toBeNull();
    expect(mapped!.message).toContain('50%');
    expect(mapped!.message).toContain('67%');
    const hrefs = mapped!.remediation.map((r) => r.href);
    expect(hrefs).toContain('/console/permissioned-l1s/remove-legacy-validators');
    expect(hrefs).toContain('/console/layer-1/advance-pchain-view');
    expect(hrefs.some((h) => h.startsWith('/docs/nodes/architecture/proposervm'))).toBe(true);
  });

  it('maps the threshold-of-stake message without a percentage', () => {
    const mapped = parseAggregationError(new Error('failed to connect to a threshold of stake'));
    expect(mapped).not.toBeNull();
    expect(mapped!.message).toMatch(/67%/);
    expect(mapped!.remediation.length).toBeGreaterThan(0);
  });

  it('returns null for transient failures so the raw error surfaces (the enclosing try may not be aggregation)', () => {
    // The step catch blocks wrap whole flows: a viem receipt timeout or a
    // Glacier fetch failure must never be relabelled as an aggregation
    // service problem. Only quorum shapes are unambiguous.
    expect(parseAggregationError(new TypeError('Failed to fetch'))).toBeNull();
    expect(
      parseAggregationError(new Error('Timed out while waiting for transaction with hash 0xabc to be confirmed')),
    ).toBeNull();
  });

  it('returns null for wallet rejections and other unrelated errors', () => {
    expect(parseAggregationError(new Error('User rejected the request'))).toBeNull();
  });

  it('returns null for invalid-request errors so the raw message surfaces', () => {
    const err = new Error('invalid hex string') as Error & { statusCode: number };
    err.statusCode = 400;
    expect(parseAggregationError(err)).toBeNull();
  });
});
