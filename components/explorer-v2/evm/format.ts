// EVM-specific formatting helpers. The shared ./format.ts covers the
// chain-agnostic bits (formatNumber, timeAgo, formatTime, truncate, formatBytes);
// this module adds wei/ether + gas conversions, which are BigInt-safe because a
// uint256 wei value blows past Number's 2^53 precision ceiling.

/** Decimal wei string → "1.2345" (fixed `decimals` significant fraction),
 *  trailing zeros trimmed. Pure integer/BigInt math — no float rounding. */
function formatUnits(wei: string | number | undefined, unit: bigint, decimals: number): string {
  if (wei === undefined || wei === null || wei === "") return "0";
  let v: bigint;
  try {
    v = BigInt(typeof wei === "number" ? Math.trunc(wei) : wei.trim());
  } catch {
    return "0";
  }
  const neg = v < 0n;
  if (neg) v = -v;
  const whole = v / unit;
  const frac = v % unit;
  let out = whole.toLocaleString("en-US");
  if (frac > 0n && decimals > 0) {
    // left-pad the fractional part to the unit width, then keep `decimals`.
    const unitDigits = unit.toString().length - 1;
    let fracStr = frac.toString().padStart(unitDigits, "0").slice(0, decimals);
    fracStr = fracStr.replace(/0+$/, "");
    if (fracStr) out += "." + fracStr;
  }
  return neg ? "-" + out : out;
}

const WEI_PER_ETHER = 1_000_000_000_000_000_000n; // 1e18
const WEI_PER_GWEI = 1_000_000_000n; // 1e9

/** wei (decimal string) → "1.2345 AVAX" (or bare number if symbol omitted). */
export function formatEther(
  wei: string | number | undefined,
  opts?: { symbol?: string; decimals?: number },
): string {
  const n = formatUnits(wei, WEI_PER_ETHER, opts?.decimals ?? 6);
  return opts?.symbol ? `${n} ${opts.symbol}` : n;
}

/** wei (decimal string) → "25.5 Gwei" — for gas prices / base fee. */
export function formatGwei(wei: string | number | undefined): string {
  if (wei === undefined || wei === null || wei === "") return "—";
  return `${formatUnits(wei, WEI_PER_GWEI, 4)} Gwei`;
}

/** gasUsed / gasLimit ratio → "42.1%" (or "—" when limit is 0/absent). */
export function gasUsedPct(used?: number, limit?: number): string {
  if (!limit || limit <= 0 || used === undefined) return "—";
  return `${((used / limit) * 100).toFixed(1)}%`;
}

/** Short label for an EVM tx: contract-creation, native transfer, or call. */
export function txKind(to: string, input: string): string {
  if (!to) return "Contract Creation";
  if (!input || input === "0x") return "Transfer";
  return "Contract Call";
}
