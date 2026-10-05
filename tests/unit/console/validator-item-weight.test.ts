import { describe, expect, it } from 'vitest';
import { validateStakePercentage } from '@/components/toolbox/coreViem/hooks/getTotalStake';
import { weightShareWarning } from '@/components/toolbox/components/ValidatorListInput/ValidatorItem';

describe('weightShareWarning', () => {
  it('gives no warning without a current total L1 weight', () => {
    expect(weightShareWarning(100n, null)).toBeNull();
    expect(weightShareWarning(100n, 0n)).toBeNull();
    expect(weightShareWarning(0n, 100n)).toBeNull();
  });

  it('gives no warning under 20%', () => {
    expect(weightShareWarning(19n, 100n)).toBeNull();
    expect(weightShareWarning(1999n, 10000n)).toBeNull();
  });

  it('states the share with two decimals from 20%', () => {
    expect(weightShareWarning(20n, 100n)).toBe(
      "This validator's weight is 20.00% of the current total L1 weight. It must be less than 20%.",
    );
    expect(weightShareWarning(2550n, 10000n)).toMatch(/is 25\.50% of the current total L1 weight/);
  });

  it('warns for the weights that the submit refuses', () => {
    for (const [weight, total] of [
      [19n, 100n],
      [20n, 100n],
      [1999n, 10000n],
      [2000n, 10000n],
      [1n, 3n],
      [100n, 100n],
    ] as const) {
      const { exceedsMaximum } = validateStakePercentage(total, weight, 0n);
      expect(weightShareWarning(weight, total) !== null).toBe(exceedsMaximum);
    }
  });
});
