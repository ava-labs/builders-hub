import { describe, expect, it } from 'vitest';
import { parseAggregationError } from './parseAggregationError';

describe('parseAggregationError', () => {
  it('maps a below-quorum error with the achieved percentage and remediation links', () => {
    const mapped = parseAggregationError(new Error('signature weight is insufficient: 67*200 > 100*100'));
    expect(mapped).not.toBeNull();
    expect(mapped!.message).toContain('50%');
    expect(mapped!.message).toContain('67%');
    expect(mapped!.message).toContain('The P-Chain view of some validators does not include your transaction yet');
    const hrefs = mapped!.remediation.map((r) => r.href);
    expect(hrefs).toContain('/console/permissioned-l1s/remove-legacy-validators');
    expect(hrefs).toContain('/console/layer-1/advance-pchain-view');
    expect(hrefs.some((h) => h.startsWith('/docs/nodes/architecture/proposervm'))).toBe(true);
  });

  it('maps the threshold-of-stake message to the connect text: offline validators or port 9651, not P-Chain lag', () => {
    const mapped = parseAggregationError(new Error('failed to connect to a threshold of stake'));
    expect(mapped).not.toBeNull();
    expect(mapped!.message).toContain('the connected validators hold less than 67% of the signing stake');
    expect(mapped!.message).toContain('offline');
    expect(mapped!.message).toContain('staking port (9651)');
    expect(mapped!.message).not.toMatch(/P-Chain view/);
    const hrefs = mapped!.remediation.map((r) => r.href);
    expect(hrefs[0]).toBe('/docs/nodes/system-requirements#networking');
    expect(hrefs).not.toContain('/console/layer-1/advance-pchain-view');
  });

  it('maps a P-Chain-sourced signing failure to two causes, with no validatorOnly cause', () => {
    // validatorOnly never applies to a P-Chain-sourced message: the P-Chain is part of the Primary Network.
    const mapped = parseAggregationError(new Error('failed to collect a threshold of signatures'), 'p-chain');
    expect(mapped).not.toBeNull();
    expect(mapped!.message).toContain('could not reach the required 67% of stake');
    expect(mapped!.message).toContain('Two causes');
    expect(mapped!.message).toContain('The P-Chain view of some validators does not include your transaction yet');
    expect(mapped!.message).toContain('Offline legacy Subnet validators');
    expect(mapped!.message).not.toMatch(/validatorOnly/);
    const hrefs = mapped!.remediation.map((r) => r.href);
    expect(hrefs).toEqual([
      '/docs/avalanche-l1s/validator-manager/registration-flow#pchain-sourced-refusal',
      '/console/permissioned-l1s/remove-legacy-validators',
      '/console/layer-1/advance-pchain-view',
      '/docs/nodes/architecture/proposervm#troubleshooting-warp-delivery-fails-on-an-idle-chain',
    ]);
  });

  it('defaults to the P-Chain-sourced text', () => {
    const err = new Error('failed to collect a threshold of signatures');
    expect(parseAggregationError(err)).toEqual(parseAggregationError(err, 'p-chain'));
  });

  it('maps an L1-sourced signing failure to three causes, with the validator-only link', () => {
    const mapped = parseAggregationError(new Error('failed to collect a threshold of signatures'), 'l1');
    expect(mapped).not.toBeNull();
    expect(mapped!.message).toContain('could not reach the required 67% of stake');
    expect(mapped!.message).toContain('Three causes');
    expect(mapped!.message).toContain('Some validators have not accepted the L1 block with your transaction yet');
    expect(mapped!.message).toContain('Offline legacy Subnet validators');
    expect(mapped!.message).toContain('The L1 sets validatorOnly, so its validators ignore the aggregator');
    expect(mapped!.message).not.toMatch(/P-Chain view/);
    const hrefs = mapped!.remediation.map((r) => r.href);
    expect(hrefs).toEqual([
      '/console/permissioned-l1s/remove-legacy-validators',
      '/docs/avalanche-l1s/validator-manager/registration-flow#validator-only-l1',
    ]);
  });

  it('gives the same connect text for both sources', () => {
    const err = new Error('failed to connect to a threshold of stake');
    expect(parseAggregationError(err, 'l1')).toEqual(parseAggregationError(err, 'p-chain'));
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
