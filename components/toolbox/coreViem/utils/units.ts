import { parseUnits } from 'viem';

/**
 * AVAX to nAVAX (1 AVAX = 10^9 nAVAX), exact for any amount a user can type.
 *
 * The SDK's `avaxToNanoAvax` multiplies a float and hands the product to
 * BigInt, which throws for about one short decimal in twenty: 1.005 * 1e9 is
 * 1004999999.9999999. This parses the decimal instead. A number goes through
 * toFixed(9) first, which rounds off the float error and never yields
 * exponent notation (String(1e-7) is "1e-7", which no decimal parser takes).
 * Digits past the ninth decimal round, as nAVAX is the smallest unit.
 */
export function toNanoAvax(avax: string | number): bigint {
  return parseUnits(typeof avax === 'number' ? avax.toFixed(9) : avax.trim(), 9);
}
