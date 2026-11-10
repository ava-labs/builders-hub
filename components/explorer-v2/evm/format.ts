// EVM-specific formatting helpers. The shared ./format.ts covers the
// chain-agnostic bits (formatNumber, timeAgo, formatTime, truncate, formatBytes);
// this module adds wei/ether + gas conversions, which are BigInt-safe because a
// uint256 wei value blows past Number's 2^53 precision ceiling.

import { paramUnit, ROLES } from "@/lib/precompiles";
import { formatPricePerGas } from "@/components/explorer-v2/format";

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

/** a fee in wei → "0.000489 AVAX"; under a millionth of the coin (a test
 *  network, or a priority fee of a few wei) in the nano unit or in wei, as a
 *  gas price reads: "0.00315 nAVAX", "210,000 wei" */
export function formatFeeAmount(wei: bigint, symbol = "AVAX", decimals = 6): string {
  return wei > 0n && wei < 1_000_000_000_000n ? formatPricePerGas(wei, symbol) : `${formatEther(wei.toString(), { decimals })} ${symbol}`;
}

/** wei → "0.22 nAVAX": gas prices in the chain's nano unit (gwei on
 *  Ethereum, nAVAX here), two places under 100, whole above */
export function formatNano(wei: string | number | undefined, symbol = "AVAX"): string {
  if (wei === undefined || wei === null || wei === "") return "—";
  const n = Number(wei) / 1e9;
  if (!Number.isFinite(n)) return "—";
  return `${n >= 100 ? Math.round(n).toLocaleString("en-US") : n.toFixed(2)} n${symbol}`;
}

/** a precompile's number in the unit it means: the native coin, a role,
 *  a gas price (in wei below a hundredth of a nano), seconds, or a count */
export function precompileValue(name: string, value: string | bigint, symbol: string): string {
  const v = BigInt(value);
  switch (paramUnit(name)) {
    case "native":
      return formatEther(v.toString(), { symbol, decimals: 6 });
    case "role":
      return ROLES[Number(v)] ?? v.toString();
    case "gasPrice":
      return v < 10_000_000n ? `${v.toLocaleString("en-US")} wei` : formatNano(v.toString(), symbol);
    case "seconds":
      return `${v} s`;
    default:
      return v.toLocaleString("en-US");
  }
}
