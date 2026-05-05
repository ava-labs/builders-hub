// Ported from @avalabs/ac-eerc-sdk (src/crypto/scalar.ts).

export const Scalar = {
  isZero(s: bigint): boolean {
    return s === 0n;
  },
  isOdd(s: bigint): boolean {
    return (s & 1n) === 1n;
  },
  shiftRight(s: bigint, n: number): bigint {
    return s >> BigInt(n);
  },

  /** Pack a "whole . fractional" pair into centsized bigint (eERC uses 2 decimals). */
  calculate(whole: bigint, fractional: bigint): bigint {
    return whole * 100n + fractional;
  },

  /** Inverse of `calculate` — split cents-encoded balance into `[whole, fractional]`. */
  recalculate(balance: bigint): [bigint, bigint] {
    const whole = balance / 100n;
    const fractional = balance % 100n;
    return [whole, fractional];
  },

  /** Format a decrypted eERC balance as a human-readable `whole.fractional` string. */
  parseEERCBalance(balance: bigint | [bigint, bigint]): string {
    let whole: bigint;
    let fractional: bigint;
    if (Array.isArray(balance)) {
      const cents = Scalar.calculate(balance[0], balance[1]);
      [whole, fractional] = Scalar.recalculate(cents);
    } else {
      [whole, fractional] = Scalar.recalculate(balance);
    }
    return `${whole.toString()}.${fractional.toString().padStart(2, '0')}`;
  },
};
