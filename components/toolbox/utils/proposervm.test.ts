import { describe, expect, it } from 'vitest';
import {
  EPOCH_DURATION_MS,
  computeEpochStatus,
  decideAdvanceAction,
  deriveProposerVMUrl,
  parseCurrentEpochResponse,
  parsePlatformHeightResponse,
  type ProposerVMEpoch,
} from './proposervm';

const NOW_MS = 1_754_600_000_000;
const NOW_SEC = NOW_MS / 1000;

function epochAt(startTimeSec: number, pChainHeight: bigint): ProposerVMEpoch {
  return { number: 7n, startTimeSec, pChainHeight };
}

describe('deriveProposerVMUrl', () => {
  it('swaps the trailing rpc segment on a node URL', () => {
    expect(deriveProposerVMUrl('https://node.example:9650/ext/bc/2ALtzRYgRpRWnTgjdrMArkMvU6RTpcjs/rpc')).toBe(
      'https://node.example:9650/ext/bc/2ALtzRYgRpRWnTgjdrMArkMvU6RTpcjs/proposervm',
    );
  });

  it('swaps the trailing rpc segment on a gateway URL', () => {
    expect(deriveProposerVMUrl('https://subnets.avax.network/echo/testnet/rpc')).toBe(
      'https://explorer.avax.network/echo/testnet/proposervm',
    );
  });

  it('tolerates a trailing slash', () => {
    expect(deriveProposerVMUrl('https://node.example/ext/bc/XYZ/rpc/')).toBe(
      'https://node.example/ext/bc/XYZ/proposervm',
    );
  });

  it('preserves a query string (provider auth tokens)', () => {
    expect(deriveProposerVMUrl('https://host.example/ext/bc/XYZ/rpc?token=abc')).toBe(
      'https://host.example/ext/bc/XYZ/proposervm?token=abc',
    );
  });

  it('returns null when the last path segment is not rpc', () => {
    expect(deriveProposerVMUrl('https://rpc.ankr.com/avalanche')).toBeNull();
  });

  it('returns null for an unparseable URL', () => {
    expect(deriveProposerVMUrl('not a url')).toBeNull();
  });
});

describe('parseCurrentEpochResponse', () => {
  it('parses the string-encoded fields avalanchego returns', () => {
    const parsed = parseCurrentEpochResponse({
      jsonrpc: '2.0',
      id: 1,
      result: { number: '56', startTime: '1754500000', pChainHeight: '291012' },
    });
    expect(parsed).toEqual({ number: 56n, startTimeSec: 1754500000, pChainHeight: 291012n });
  });

  it('parses the pre-Granite all-zeros response without throwing', () => {
    const parsed = parseCurrentEpochResponse({
      jsonrpc: '2.0',
      id: 1,
      result: { number: '0', startTime: '0', pChainHeight: '0' },
    });
    expect(parsed).toEqual({ number: 0n, startTimeSec: 0, pChainHeight: 0n });
  });

  it('throws the RPC error message when the node returns an error', () => {
    expect(() =>
      parseCurrentEpochResponse({ jsonrpc: '2.0', id: 1, error: { message: 'proposervm API not enabled' } }),
    ).toThrow(/proposervm API not enabled/);
  });

  it('throws on a malformed result', () => {
    expect(() =>
      parseCurrentEpochResponse({ jsonrpc: '2.0', id: 1, result: { number: 'x', startTime: '1', pChainHeight: '2' } }),
    ).toThrow();
    expect(() => parseCurrentEpochResponse({ jsonrpc: '2.0', id: 1 })).toThrow();
  });
});

describe('parsePlatformHeightResponse', () => {
  it('parses the string-encoded platform.getHeight result', () => {
    expect(parsePlatformHeightResponse({ jsonrpc: '2.0', id: 1, result: { height: '302171' } })).toBe(302_171n);
  });

  it('throws the RPC error message when the node returns an error', () => {
    expect(() => parsePlatformHeightResponse({ jsonrpc: '2.0', id: 1, error: { message: 'rate limited' } })).toThrow(
      /rate limited/,
    );
  });

  it('throws on a malformed result', () => {
    expect(() => parsePlatformHeightResponse({ jsonrpc: '2.0', id: 1, result: {} })).toThrow(/platform\.getHeight/);
  });
});

describe('computeEpochStatus', () => {
  it('is unknown when the epoch could not be read', () => {
    const status = computeEpochStatus({
      epoch: null,
      liveHeight: 302_171n,
      tipTimestampSec: NOW_SEC - 120,
      nowMs: NOW_MS,
    });
    expect(status.state).toBe('unknown');
    expect(status.heightLag).toBeNull();
    expect(status.sealableAtMs).toBeNull();
    expect(status.tipAgeSec).toBe(120);
  });

  it('is satisfied when the pinned height covers the required height, even on an idle chain', () => {
    const status = computeEpochStatus({
      epoch: epochAt(NOW_SEC - 42 * 86_400, 302_170n),
      liveHeight: 302_171n,
      tipTimestampSec: null,
      nowMs: NOW_MS,
      requiredHeight: 302_168n,
    });
    expect(status.state).toBe('satisfied');
    expect(status.heightLag).toBe(1n);
  });

  it('is stale-sealable when required exceeds pinned and the epoch is past its duration', () => {
    const startSec = NOW_SEC - 42 * 86_400;
    const status = computeEpochStatus({
      epoch: epochAt(startSec, 291_012n),
      liveHeight: 302_171n,
      tipTimestampSec: null,
      nowMs: NOW_MS,
      requiredHeight: 302_168n,
    });
    expect(status.state).toBe('stale-sealable');
    expect(status.sealableAtMs).toBe(startSec * 1000 + EPOCH_DURATION_MS);
  });

  it('is stale-waiting with the seal moment when the epoch is younger than its duration', () => {
    const startSec = NOW_SEC - 90;
    const status = computeEpochStatus({
      epoch: epochAt(startSec, 291_012n),
      liveHeight: 302_171n,
      tipTimestampSec: null,
      nowMs: NOW_MS,
      requiredHeight: 302_168n,
    });
    expect(status.state).toBe('stale-waiting');
    expect(status.sealableAtMs).toBe(startSec * 1000 + EPOCH_DURATION_MS);
  });

  it('treats the exact seal boundary as sealable', () => {
    const startSec = NOW_SEC - EPOCH_DURATION_MS / 1000;
    const status = computeEpochStatus({
      epoch: epochAt(startSec, 291_012n),
      liveHeight: 302_171n,
      tipTimestampSec: null,
      nowMs: NOW_MS,
      requiredHeight: 302_168n,
    });
    expect(status.state).toBe('stale-sealable');
  });

  it('does not call a healthy chain stale while its epoch is current (no required height)', () => {
    const status = computeEpochStatus({
      epoch: epochAt(NOW_SEC - 240, 302_100n),
      liveHeight: 302_171n,
      tipTimestampSec: NOW_SEC - 3,
      nowMs: NOW_MS,
    });
    expect(status.state).toBe('satisfied');
  });

  it('grants an actively producing chain one epoch of grace before calling it stale (no required height)', () => {
    const status = computeEpochStatus({
      epoch: epochAt(NOW_SEC - 7 * 60, 302_100n),
      liveHeight: 302_171n,
      tipTimestampSec: NOW_SEC - 30,
      nowMs: NOW_MS,
    });
    expect(status.state).toBe('satisfied');
  });

  it('flags a chain a full extra epoch overdue as stale (no required height)', () => {
    const startSec = NOW_SEC - (2 * EPOCH_DURATION_MS) / 1000;
    const status = computeEpochStatus({
      epoch: epochAt(startSec, 291_012n),
      liveHeight: 302_171n,
      tipTimestampSec: NOW_SEC - 600,
      nowMs: NOW_MS,
    });
    expect(status.state).toBe('stale-sealable');
    expect(status.heightLag).toBe(11_159n);
  });

  it('clamps the height lag at zero when RPC views skew', () => {
    const status = computeEpochStatus({
      epoch: epochAt(NOW_SEC - 60, 302_172n),
      liveHeight: 302_171n,
      tipTimestampSec: null,
      nowMs: NOW_MS,
    });
    expect(status.heightLag).toBe(0n);
  });

  it('leaves heightLag and tipAgeSec null when their inputs are missing', () => {
    const status = computeEpochStatus({
      epoch: epochAt(NOW_SEC - 60, 302_100n),
      liveHeight: null,
      tipTimestampSec: null,
      nowMs: NOW_MS,
    });
    expect(status.heightLag).toBeNull();
    expect(status.tipAgeSec).toBeNull();
  });
});

describe('decideAdvanceAction', () => {
  const caps = { maxSends: 4, blindSends: 2 };
  const staleEpoch = epochAt(NOW_SEC - 42 * 86_400, 291_012n);

  function decide(overrides: Partial<Parameters<typeof decideAdvanceAction>[0]>) {
    return decideAdvanceAction({
      epoch: staleEpoch,
      liveHeight: 302_171n,
      tipTimestampSec: null,
      nowMs: NOW_MS,
      requiredHeight: 302_168n,
      blindRun: false,
      sends: 0,
      ...caps,
      ...overrides,
    });
  }

  it('sends in a blind run until the blind budget is spent, then finishes unverified', () => {
    expect(decide({ blindRun: true, epoch: null, sends: 0 })).toEqual({ action: 'send' });
    expect(decide({ blindRun: true, epoch: null, sends: 1 })).toEqual({ action: 'send' });
    expect(decide({ blindRun: true, epoch: null, sends: 2 })).toEqual({ action: 'done-unverified' });
  });

  it('finishes verified as soon as the pinned height covers the requirement', () => {
    expect(decide({ epoch: epochAt(NOW_SEC - 42 * 86_400, 302_170n), sends: 1 })).toEqual({
      action: 'done-verified',
    });
  });

  it('keeps sending when a mid-run epoch read fails in a run that started verifiable', () => {
    expect(decide({ epoch: null, sends: 1 })).toEqual({ action: 'send' });
  });

  it('gives up instead of finishing when reads stay failed at the send cap', () => {
    expect(decide({ epoch: null, sends: 4 })).toEqual({ action: 'give-up' });
  });

  it('waits for the seal moment when the epoch is younger than its duration', () => {
    const startSec = NOW_SEC - 90;
    const decision = decide({ epoch: epochAt(startSec, 291_012n) });
    expect(decision).toEqual({ action: 'wait', untilMs: startSec * 1000 + EPOCH_DURATION_MS });
  });

  it('sends when the epoch is sealable and the target is unmet', () => {
    expect(decide({ sends: 3 })).toEqual({ action: 'send' });
  });

  it('gives up at the send cap when the target stays unmet', () => {
    expect(decide({ sends: 4 })).toEqual({ action: 'give-up' });
  });

  it('treats the no-target heuristic as the goal when no required height is given', () => {
    expect(decide({ requiredHeight: null, epoch: epochAt(NOW_SEC - 240, 302_100n) })).toEqual({
      action: 'done-verified',
    });
    expect(decide({ requiredHeight: null, epoch: staleEpoch })).toEqual({ action: 'send' });
  });
});
