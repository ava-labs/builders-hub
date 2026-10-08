import { describe, expect, it } from 'vitest';
import { pctOfDailyTarget, targetDays, targetExponentOf, targetOf, targetOfExponent } from '@/lib/gas-target-math';

describe('gas target', () => {
  it('decodes the C-Chain target from an SAE header field', () => {
    // mainnet since Helicon: targetExponent 46,516,320 is 4M gas/s
    expect(targetOf({ targetExponent: '0x2c5c860' }, 43114)! / 1e6).toBeCloseTo(4, 3);
  });

  it('decodes the target excess packed in a pre-SAE coreth header', () => {
    const extra = '0x' + '00000000022eae37' + '0000000170d93346' + '0000000002c5c860' + '000000000000';
    expect(targetExponentOf({ extraData: extra }, 43114)).toBe(46_516_320);
  });

  it('reads no target from a chain that prices without ACP-176', () => {
    const extra = '0x' + '00'.repeat(80);
    expect(targetOf({ extraData: extra }, 43114)).toBeNull();
    expect(targetOf({ extraData: '0x' + '00'.repeat(30) }, 1234)).toBeNull();
  });

  it('starts the target at P = 1M gas/s', () => {
    expect(targetOfExponent(0)).toBe(1_000_000);
  });

  it('measures a day against what its target allows', () => {
    expect(pctOfDailyTarget(4_000_000 * 86_400, 4_000_000)).toBe(100);
    expect(pctOfDailyTarget(1, 0)).toBe(0);
  });

  it('joins each day to its own target, so a target change moves the denominator', () => {
    const rows = [
      { d: '2026-10-06', gas: 172_800_000_000, blocks: 10 },
      { d: '2026-10-07', gas: 172_800_000_000, blocks: 10 },
      { d: '2026-10-08', gas: 1, blocks: 1 },
    ];
    const days = targetDays(
      rows,
      new Map([['2026-10-06', 4_000_000], ['2026-10-07', 8_000_000]]),
      new Map([['2026-10-06', 86_400_000_000]]),
    );
    expect(days.map((d) => d.d)).toEqual(['2026-10-06', '2026-10-07']);
    expect(days[0].reservedPct).toBe(50);
    expect(days[0].chargedPct).toBe(25);
    expect(days[1].reservedPct).toBe(25);
    expect(days[1].chargedPct).toBeNull();
  });
});
