import { describe, expect, it } from 'vitest';
import { calculatePrice, executedBaseFee, feeAmounts, priceFloor, splitPaid, tipAt } from '@/lib/evm-fee';
import { formatPricePerGas } from '@/components/explorer-v2/format';
import { formatFeeAmount } from '@/components/explorer-v2/evm/format';

// What a C-Chain transaction pays per gas and how the price splits into the base fee and the tip. The transactions
// below were read from the public RPC on 2026-10-08 (eth_getTransactionByHash, eth_getTransactionReceipt and the
// header of their block). Since Helicon the header base fee is the worst-case bound; the receipt's effectiveGasPrice
// is the price paid.

const NANO = 1_000_000_000n;

describe('the tip a bid pays at a base fee', () => {
  it('a dynamic-fee tx pays its max priority fee while its max fee has room', () => {
    expect(tipAt({ maxFeePerGas: 66n * NANO, maxPriorityFeePerGas: 3n * NANO }, 5n * NANO)).toBe(3n * NANO);
  });

  it('the max fee caps the tip', () => {
    expect(tipAt({ maxFeePerGas: 5n * NANO + 100n, maxPriorityFeePerGas: NANO }, 5n * NANO)).toBe(100n);
  });

  it('a legacy tx pays the part of its gas price above the base fee as its tip', () => {
    expect(tipAt({ gasPrice: 7n * NANO }, 5n * NANO)).toBe(2n * NANO);
  });

  it('a bid under the base fee pays nothing: it cannot go in a block', () => {
    expect(tipAt({ maxFeePerGas: 4n * NANO, maxPriorityFeePerGas: NANO }, 5n * NANO)).toBeNull();
    expect(tipAt({ gasPrice: 4n * NANO }, 5n * NANO)).toBeNull();
  });
});

describe('the base fee and the tip inside a paid price', () => {
  it('0x799c…f3fd paid less than its max fee, so it paid its whole 157 wei tip, under its block header bound', () => {
    // block 97,066,434: header baseFeePerGas 5,043,419,527; the tx's own gasPrice field reads header + tip
    const split = splitPaid(
      { maxFeePerGas: 10_001_116_201n, maxPriorityFeePerGas: 157n },
      5_038_755_882n,
      { bound: 5_043_419_527n, floor: 5n * NANO },
    );
    expect(split).toEqual({ base: 5_038_755_725n, tip: 157n, exact: true });
  });

  it('0xcd1f…0fd9 paid the 150 wei a wallet suggests over the 5 nAVAX base fee', () => {
    const split = splitPaid({ maxFeePerGas: 10_000_000_150n, maxPriorityFeePerGas: 150n }, 5_000_000_150n, { bound: 5n * NANO, floor: 5n * NANO });
    expect(split).toEqual({ base: 5n * NANO, tip: 150n, exact: true });
  });

  it('0x54b7…88dd paid a 3 nAVAX tip', () => {
    const split = splitPaid({ maxFeePerGas: 66n * NANO, maxPriorityFeePerGas: 3n * NANO }, 8n * NANO, { bound: 5n * NANO, floor: 5n * NANO });
    expect(split).toEqual({ base: 5n * NANO, tip: 3n * NANO, exact: true });
  });

  it('legacy 0xe6d1…9874 at 7 nAVAX: the base fee sat at its floor, so the 2 nAVAX tip is exact', () => {
    expect(splitPaid({ gasPrice: 7n * NANO }, 7n * NANO, { bound: 5n * NANO, floor: 5n * NANO })).toEqual({ base: 5n * NANO, tip: 2n * NANO, exact: true });
  });

  it('a legacy tx in a block whose bound is over the floor gives the smallest tip, marked as not exact', () => {
    expect(splitPaid({ gasPrice: 5_250_000_000n }, 5_250_000_000n, { bound: 5_100_000_000n, floor: 5n * NANO })).toEqual({
      base: 5_100_000_000n,
      tip: 150_000_000n,
      exact: false,
    });
  });

  it('a tx that paid its max fee fixes only the sum', () => {
    const bid = { maxFeePerGas: 5n * NANO + 100n, maxPriorityFeePerGas: NANO };
    expect(splitPaid(bid, 5n * NANO + 100n, { bound: 5n * NANO, floor: 5n * NANO })).toEqual({ base: 5n * NANO, tip: 100n, exact: true });
    expect(splitPaid(bid, 5n * NANO + 100n, { bound: 5n * NANO + 50n, floor: 5n * NANO }).exact).toBe(false);
  });

  it('without a floor (a chain whose header base fee is the price) the bound is the base fee', () => {
    expect(splitPaid({ gasPrice: 30n * NANO }, 30n * NANO, { bound: 25n * NANO, floor: 25n * NANO })).toEqual({ base: 25n * NANO, tip: 5n * NANO, exact: true });
  });
});

describe('the base fee a block charged', () => {
  it('reads back from a dynamic-fee tx that paid less than its max fee', () => {
    // block 97,067,017: header bound 5,096,654,075; legacy 0xc6a8…b3a0 paid 7.5 nAVAX beside one dynamic-fee tx
    const txs = [
      { bid: { gasPrice: 7_500_000_000n }, paid: 7_500_000_000n },
      { bid: { maxFeePerGas: 5_038_000_100n, maxPriorityFeePerGas: NANO }, paid: 5_038_000_100n },
      { bid: { maxFeePerGas: 10n * NANO, maxPriorityFeePerGas: 150n }, paid: 5_038_412_150n },
    ];
    expect(executedBaseFee(txs)).toBe(5_038_412_000n);
  });

  it('is unknown when no tx fixes it', () => {
    expect(executedBaseFee([{ bid: { gasPrice: 7n * NANO }, paid: 7n * NANO }])).toBeNull();
    expect(executedBaseFee([{ bid: { maxFeePerGas: 6n * NANO, maxPriorityFeePerGas: NANO }, paid: 6n * NANO }])).toBeNull();
    expect(executedBaseFee([])).toBeNull();
  });
});

describe('the validators minimum gas price (ACP-283)', () => {
  it('decodes the header minPriceExponent to the wei, as the node does', () => {
    // mainnet header at 2026-10-08 20:58 UTC: minPriceExponent 9,286,575,467,231,524,556, baseFeePerGas 5,000,000,000
    expect(priceFloor(9_286_575_467_231_524_556n)).toBe(5n * NANO);
    // the initial exponent 0 is the 1 wei minimum
    expect(priceFloor(0n)).toBe(1n);
  });

  it('uses the integer series the node uses for its other exponents', () => {
    // ACP-176 gas target: 1,000,000 x e^(t / 2^25); the live targetExponent 46,516,320 is 4M gas per second
    expect(calculatePrice(1_000_000n, 46_516_320n, 1n << 25n)).toBe(4_000_000n);
    // ACP-226 minimum block delay in ms: e^(q / 2^20); the live minDelayExcess 7,009,324 is 800 ms
    expect(calculatePrice(1n, 7_009_324n, 1n << 20n)).toBe(800n);
  });

  it('doubles for each conversionRate x ln 2 of exponent', () => {
    const double = 288_230_376_151_711_744n;
    const a = priceFloor(10n * double);
    expect(a).toBeGreaterThanOrEqual(1023n);
    expect(a).toBeLessThanOrEqual(1024n);
  });
});

describe('a gas price on the page', () => {
  it('writes a tip of a few hundred wei in wei, not as zero', () => {
    expect(formatPricePerGas(150n)).toBe('150 wei');
    expect(formatPricePerGas('100000')).toBe('100,000 wei');
    expect(formatPricePerGas(0)).toBe('0 wei');
  });

  it('writes a price in nAVAX from a thousandth of a nano up', () => {
    expect(formatPricePerGas(5_000_000_150n)).toBe('5.000 nAVAX');
    expect(formatPricePerGas(5_043_419_527n)).toBe('5.043 nAVAX');
    expect(formatPricePerGas(150_000_000n)).toBe('0.15 nAVAX');
    expect(formatPricePerGas(1_000_000n)).toBe('0.001 nAVAX');
    expect(formatPricePerGas(125_400_000_000n)).toBe('125 nAVAX');
  });

  it('names the chain token, and a dash for no value', () => {
    expect(formatPricePerGas(25n * NANO, 'BEAM')).toBe('25.000 nBEAM');
    expect(formatPricePerGas(undefined)).toBe('—');
    expect(formatPricePerGas('not a number')).toBe('—');
  });
});

describe('the parts of a fee in the Fee box', () => {
  it('cuts the amounts to eight places, and the parts add up to the total as shown', () => {
    // 0x54b7bdbd...88dd: 61,138 gas at 5 nAVAX base fee + 3 nAVAX priority fee
    const a = feeAmounts(5n * NANO, 8n * NANO, 61_138n);
    expect(formatFeeAmount(a.base, 'AVAX', 8)).toBe('0.00030569 AVAX');
    expect(formatFeeAmount(a.tip, 'AVAX', 8)).toBe('0.00018341 AVAX');
    expect(formatFeeAmount(a.total, 'AVAX', 8)).toBe('0.0004891 AVAX');
    expect(a.base + a.tip).toBe(a.total);
  });

  it('gives the priority fee the rest when each part alone rounds down', () => {
    // 1/3 nAVAX parts: cut alone, the two parts would add up to one place less than the total
    const a = feeAmounts(3_333_333_333n, 6_666_666_667n, 1_000_003n);
    expect(a.base + a.tip).toBe(a.total);
    expect(a.total % 10_000_000_000n).toBe(0n);
  });

  it('keeps a priority fee under a millionth of the coin whole, in its own unit', () => {
    // 0xcd1f534c...0fd9: 21,000 gas with the 150 wei tip that wallets suggest
    const a = feeAmounts(5n * NANO, 5n * NANO + 150n, 21_000n);
    expect(a.tip).toBe(3_150_000n);
    expect(formatFeeAmount(a.tip)).toBe('0.00315 nAVAX');
    expect(formatFeeAmount(a.total, 'AVAX', 8)).toBe('0.000105 AVAX');
  });

  it('cuts the priority fee to eight places when the base fee part is under a millionth of the coin', () => {
    // Fuji 0xaff11b79...3005: 21,000 gas, a 10 wei base fee, 433,607,420 wei paid per gas
    const a = feeAmounts(10n, 433_607_420n, 21_000n);
    expect(formatFeeAmount(a.base)).toBe('210,000 wei');
    expect(formatFeeAmount(a.tip, 'AVAX', 8)).toBe('0.0000091 AVAX');
    expect(formatFeeAmount(a.total, 'AVAX', 8)).toBe('0.0000091 AVAX');
  });

  it('reads a fee in wei on a test network', () => {
    // Fuji: a 10 wei base fee
    expect(formatFeeAmount(feeAmounts(10n, 10n, 21_000n).total)).toBe('210,000 wei');
  });
});
