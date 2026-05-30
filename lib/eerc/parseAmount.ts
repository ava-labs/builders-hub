/**
 * Parse a user-typed eERC amount string (e.g. "12.34") into the cents
 * bigint the contract works in. Returns `null` on invalid input or a
 * zero-rounded amount.
 *
 * Why a string-based parser instead of `Number(input) * 100`:
 *   - JS Number is IEEE 754 double, accurate to ~15 significant digits.
 *     A user pasting "1234567890123.45" would get the wrong cents because
 *     the float can't represent the exact value, and `Math.round(n * 100)`
 *     propagates the drift.
 *   - The contract's encrypted ledger stores cents as an integer. Round-
 *     tripping through a float adds a precision risk for no benefit when
 *     the user already gave us a decimal string.
 *
 * Rounding: half-up at the 2-decimal boundary, matching the previous
 * `Math.round(n * 100)` behavior for inputs in float range. "0.999"
 * becomes 100n (= 1.00).
 *
 * Returns null for:
 *   - non-decimal input (negatives, scientific notation, anything that
 *     isn't `\d+(\.\d+)?`)
 *   - zero amounts (after rounding) — the caller wants positive amounts
 *     only and surfaces a generic "Amount must be positive" error.
 */
export function parseEERCAmount(input: string): bigint | null {
  if (!input) return null;
  const trimmed = input.trim();
  if (!/^\d+(\.\d+)?$/.test(trimmed)) return null;

  const [wholePart, fractionPart = ''] = trimmed.split('.');
  const whole = BigInt(wholePart);

  let cents: bigint;
  if (fractionPart.length === 0) {
    cents = 0n;
  } else if (fractionPart.length === 1) {
    cents = BigInt(fractionPart) * 10n;
  } else {
    cents = BigInt(fractionPart.slice(0, 2));
    // Round half-up using the third decimal digit. ASCII '5' is 53;
    // comparing the char code dodges the cost of slicing another byte.
    if (fractionPart.length > 2 && fractionPart.charCodeAt(2) >= 53) {
      cents += 1n;
    }
  }

  // `cents` can be 100 here (e.g. fractionPart "999" → 99 + 1 = 100). The
  // multiplication below carries that into the whole-number place
  // automatically — `1 * 100 + 100 = 200` is the correct cents encoding
  // for "1.999" rounded to "2.00".
  const total = whole * 100n + cents;
  return total > 0n ? total : null;
}
