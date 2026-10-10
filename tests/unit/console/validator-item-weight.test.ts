import { describe, expect, it } from 'vitest';
import { validateStakePercentage } from '@/components/toolbox/coreViem/hooks/getTotalStake';
import {
  maxNewValidatorWeight,
  weightShareWarning,
} from '@/components/toolbox/components/ValidatorListInput/ValidatorItem';

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

  it('states the share with two decimals from 20%, and the highest valid weight', () => {
    expect(weightShareWarning(20n, 100n)).toBe(
      "This validator's weight is 20.00% of the current total L1 weight. It must be less than 20%. Enter 19 or less.",
    );
    expect(weightShareWarning(100n, 100n)).toMatch(/is 100\.00% of .* Enter 19 or less\.$/);
    expect(weightShareWarning(2550n, 10000n)).toMatch(/is 25\.50% of the current total L1 weight/);
    expect(weightShareWarning(2550n, 10000n)).toMatch(/Enter 1999 or less\.$/);
  });

  it('says that no weight is valid when the total is too low for a new validator', () => {
    expect(weightShareWarning(1n, 3n)).toMatch(
      /It must be less than 20%\. The total L1 weight is too low for a new validator\.$/,
    );
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

  it('gives the highest weight that the submit accepts', () => {
    for (const total of [1n, 4n, 5n, 6n, 100n, 101n, 104n, 105n, 10000n, 123456789n]) {
      const max = maxNewValidatorWeight(total);
      if (max > 0n) expect(validateStakePercentage(total, max, 0n).exceedsMaximum).toBe(false);
      expect(validateStakePercentage(total, max + 1n, 0n).exceedsMaximum).toBe(true);
    }
    expect(maxNewValidatorWeight(100n)).toBe(19n);
    expect(maxNewValidatorWeight(101n)).toBe(20n);
    expect(maxNewValidatorWeight(5n)).toBe(0n);
  });
});
