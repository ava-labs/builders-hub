import { describe, expect, it } from 'vitest';
import { avaxToNanoAvax } from '@avalanche-sdk/client/utils';

import { toNanoAvax } from '@/components/toolbox/coreViem/utils/units';

describe('toNanoAvax', () => {
  it('converts the amounts the SDK helper throws on', () => {
    expect(() => avaxToNanoAvax(1.005)).toThrow();
    expect(toNanoAvax('1.005')).toBe(1_005_000_000n);
    expect(toNanoAvax(1.005)).toBe(1_005_000_000n);
    expect(toNanoAvax('0.134')).toBe(134_000_000n);
  });

  it('is exact for every amount of up to three decimals below 10 AVAX', () => {
    for (let milli = 1; milli <= 10_000; milli++) {
      const typed = (milli / 1000).toFixed(3);
      const expected = BigInt(milli) * 1_000_000n;
      expect(toNanoAvax(typed)).toBe(expected);
      expect(toNanoAvax(Number(typed))).toBe(expected);
    }
  });

  it('takes the forms users type', () => {
    expect(toNanoAvax(' 2 ')).toBe(2_000_000_000n);
    expect(toNanoAvax('.5')).toBe(500_000_000n);
    expect(toNanoAvax('0.000000001')).toBe(1n);
    expect(toNanoAvax(1e-7)).toBe(100n);
    expect(toNanoAvax('2000000.123456789')).toBe(2_000_000_123_456_789n);
  });

  it('rejects what is not a decimal', () => {
    expect(() => toNanoAvax('abc')).toThrow();
    expect(() => toNanoAvax('1,5')).toThrow();
  });
});
