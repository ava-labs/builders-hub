import { describe, expect, it } from 'vitest';
import {
  baseFeeNow,
  cadenceOf,
  chargedBaseFee,
  costOf,
  fillOf,
  minBlockDelayMs,
  tipStats,
  type MarketBlock,
  type MarketTx,
} from '@/lib/fee-market';

// The gas page's "Fee market now" figures, from blocks read off the RPC. Since Helicon a header's base fee is the
// worst-case bound and the receipts show the base fee charged; one base fee applies to the whole block.

const NANO = 1_000_000_000n;
const FLOOR = 5n * NANO;

const dyn = (maxFee: bigint, tip: bigint, paid: bigint): MarketTx => ({ bid: { maxFeePerGas: maxFee, maxPriorityFeePerGas: tip }, paid });
const legacy = (price: bigint): MarketTx => ({ bid: { gasPrice: price }, paid: price });

function block(n: number, over: Partial<MarketBlock> = {}): MarketBlock {
  return {
    number: n,
    timestampMs: 1_791_492_000_000 + (n - 100) * 800,
    bound: FLOOR,
    floor: FLOOR,
    target: 4_000_000,
    minDelayMs: 800,
    reserved: 42_000,
    gasLimit: 80_000_000,
    txs: [],
    ...over,
  };
}

describe('the header exponents', () => {
  it('decode to the live minimum block delay', () => {
    expect(minBlockDelayMs(7_009_324n)).toBe(800);
    // the delay voted until 2026-10-08 ~15:08 UTC
    expect(minBlockDelayMs(7_072_894n)).toBe(850);
  });
});

describe('the base fee a block charged', () => {
  it('reads back from a dynamic-fee receipt under the bound', () => {
    // block 97,066,395: header 5.0X bound, 13 receipts that all imply 5,026,103,004
    const b = block(395, { bound: 5_109_304_163n, txs: [legacy(7n * NANO), dyn(10n * NANO, 150n, 5_026_103_154n)] });
    expect(chargedBaseFee(b)).toBe(5_026_103_004n);
  });

  it('is the bound when the bound sits at the floor', () => {
    expect(chargedBaseFee(block(1, { txs: [legacy(7n * NANO)] }))).toBe(FLOOR);
  });

  it('is unknown with only legacy txs and a bound over the floor', () => {
    expect(chargedBaseFee(block(1, { bound: 5_100_000_000n, txs: [legacy(7n * NANO)] }))).toBeNull();
  });

  it('now: the newest block that fixes it', () => {
    const blocks = [
      block(10, { txs: [dyn(10n * NANO, 150n, 5_000_000_150n)] }),
      block(12, { bound: 5_100_000_000n, txs: [legacy(7n * NANO)] }),
      block(11, { bound: 5_090_000_000n, txs: [dyn(10n * NANO, 150n, 5_040_000_150n)] }),
    ];
    expect(baseFeeNow(blocks)).toMatchObject({ fee: 5_040_000_000n, block: { number: 11 } });
    expect(baseFeeNow([])).toBeNull();
  });
});

describe('the priority fees paid', () => {
  it('bands the txs by count', () => {
    const blocks = [
      block(1, {
        txs: [
          dyn(10n * NANO, 150n, FLOOR + 150n),
          dyn(10n * NANO, 150n, FLOOR + 150n),
          dyn(10n * NANO, 50_000_000n, FLOOR + 50_000_000n),
          dyn(66n * NANO, 3n * NANO, 8n * NANO),
          legacy(7n * NANO),
        ],
      }),
    ];
    const s = tipStats(blocks, 150n)!;
    expect(s.txs).toBe(5);
    expect(s.low).toBeCloseTo(2 / 5);
    expect(s.mid).toBeCloseTo(1 / 5);
    expect(s.high).toBeCloseTo(2 / 5);
  });

  it('leaves out a block whose base fee is unknown', () => {
    expect(tipStats([block(1, { bound: 5_100_000_000n, txs: [legacy(7n * NANO)] })], 150n)).toBeNull();
  });
});

describe('how full the blocks are', () => {
  it('is the fullest block\'s reserved gas over its gas limit', () => {
    // since Helicon a header's gasUsed is the sum of its txs' gas limits
    const blocks = [block(1, { reserved: 300_000 }), block(2, { reserved: 8_000_000 }), block(3, { reserved: 21_000 })];
    expect(fillOf(blocks)).toBeCloseTo(0.1);
    expect(fillOf([])).toBeNull();
  });
});

describe('the wait for a block', () => {
  it('is the mean residual of each gap: a missed proposer slot waits whole, an idle stretch hardly at all', () => {
    // 48 gaps of 800 ms, one idle gap of 2.8 s that the next tx ended, and one 5 s gap when the slot-0 proposer missed
    const gaps = [...Array<number>(48).fill(800), 2_800, 5_000];
    const blocks: MarketBlock[] = [block(0, { timestampMs: 0 })];
    gaps.forEach((d, i) => blocks.push(block(i + 1, { timestampMs: blocks[i].timestampMs + d })));
    const c = cadenceOf(blocks)!;
    expect(c.medianMs).toBe(800);
    const waited = 48 * (800 * 800) / 2 + (800 * 800) / 2 + 2_000 * 50 + (5_000 * 5_000) / 2;
    expect(c.waitMs).toBeCloseTo(waited / (48 * 800 + 2_800 + 5_000));
    expect(c.minDelayMs).toBe(800);
  });

  it('skips the gap across a missing block', () => {
    const c = cadenceOf([block(1, { timestampMs: 0 }), block(2, { timestampMs: 800 }), block(9, { timestampMs: 9_000 })])!;
    expect(c.medianMs).toBe(800);
  });
});

describe('the cost of an action now', () => {
  it('is its gas at the base fee plus the priority fee', () => {
    // an AVAX transfer and a swap at 5 nAVAX and the 150 wei the node suggests
    expect(costOf(21_000, FLOOR + 150n)).toBe(105_000_003_150_000n);
    expect(costOf(165_000n, FLOOR + 150n)).toBe(825_000_024_750_000n);
  });
});
