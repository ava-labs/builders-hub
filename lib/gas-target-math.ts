/* ACP-176's gas target, decoded from a block header: the sustained gas per
   second the base fee holds steady at. Block gas limits are burst ceilings
   (ACP-176's capacity C = 10 * T, then ACP-194's tau * lambda * 2T), so
   utilization against the target is the measure of how busy a chain is. */

const MIN_TARGET_PER_SECOND = 1_000_000; // P
const TARGET_CONVERSION = 2 ** 25; // D
const C_CHAINS = new Set([43114, 43113]);

export interface TargetHeader {
  /** SAE headers (Helicon onwards) carry the exponent as its own field */
  targetExponent?: string | null;
  /** pre-SAE ACP-176 headers pack capacity, excess and target excess here */
  extraData?: string;
}

/** target gas per second: P * e^(q / D) */
export function targetOfExponent(q: number): number {
  return MIN_TARGET_PER_SECOND * Math.exp(q / TARGET_CONVERSION);
}

/** the header's target excess q, or null when the chain prices without ACP-176 */
export function targetExponentOf(header: TargetHeader, evmChainId: number): number | null {
  if (header.targetExponent) return parseInt(header.targetExponent, 16);
  // coreth before SAE: three uint64s (capacity, excess, target excess), then
  // later forks' fields; pre-Fortuna's 80-byte fee window is not ACP-176
  const hex = header.extraData?.replace(/^0x/, "") ?? "";
  if (!C_CHAINS.has(evmChainId) || hex.length < 48 || hex.length >= 160) return null;
  return parseInt(hex.slice(32, 48), 16);
}

export function targetOf(header: TargetHeader, evmChainId: number): number | null {
  const q = targetExponentOf(header, evmChainId);
  return q === null || !Number.isFinite(q) ? null : targetOfExponent(q);
}

/** a day's gas as a percent of what the target allows in a day */
export function pctOfDailyTarget(gas: number, targetPerSecond: number): number {
  return targetPerSecond > 0 ? (gas / (targetPerSecond * 86_400)) * 100 : 0;
}

export interface TargetDay {
  d: string;
  /** mean ACP-176 target over the day, gas per second */
  target: number;
  /** the block headers' gas: tx gas limits since Helicon */
  reserved: number;
  /** the receipts' gas: what fees and the gas clock count, max(used, limit / 2) since Helicon */
  charged: number | null;
  reservedPct: number;
  chargedPct: number | null;
  blocks: number;
}

/** join the daily reserved gas, charged gas and target into percents of the day's target */
export function targetDays(
  rows: { d: string; gas: number; blocks: number }[],
  targets: ReadonlyMap<string, number>,
  charged: ReadonlyMap<string, number>,
): TargetDay[] {
  const out: TargetDay[] = [];
  for (const r of rows) {
    const target = targets.get(r.d);
    if (!target) continue;
    const c = charged.get(r.d) ?? null;
    out.push({
      d: r.d,
      target,
      reserved: r.gas,
      charged: c,
      reservedPct: pctOfDailyTarget(r.gas, target),
      chargedPct: c === null ? null : pctOfDailyTarget(c, target),
      blocks: r.blocks,
    });
  }
  return out;
}
