// Formatting helpers for the P-chain explorer (nAVAX amounts, timestamps, hashes).

/** nAVAX (string|number) → "1,234.5678 AVAX" */
export function formatAvax(
  nAvax: string | number | undefined,
  opts?: { compact?: boolean; symbol?: boolean },
): string {
  if (nAvax === undefined || nAvax === null || nAvax === "") return "—";
  const v = Number(nAvax) / 1e9;
  if (Number.isNaN(v)) return "—";
  const suffix = opts?.symbol === false ? "" : " AVAX";
  if (opts?.compact && Math.abs(v) >= 1_000_000) {
    return `${(v / 1_000_000).toLocaleString(undefined, { maximumFractionDigits: 2 })}M${suffix}`;
  }
  const digits = Math.abs(v) >= 1 ? 4 : 9;
  return `${v.toLocaleString(undefined, { maximumFractionDigits: digits })}${suffix}`;
}

export function formatNumber(n: number | undefined): string {
  return n === undefined || n === null ? "—" : n.toLocaleString("en-US");
}

/** nAVAX + a USD/AVAX rate → "$1,234.56". Returns undefined when there is no
 *  rate to apply, so callers can omit the line entirely rather than render a
 *  confident "$0.00" for a price we simply do not have. */
export function formatUsd(nAvax: string | number | undefined, avaxUsd: number | null): string | undefined {
  if (!avaxUsd || avaxUsd <= 0 || nAvax === undefined || nAvax === null || nAvax === "") return undefined;
  const usd = (Number(nAvax) / 1e9) * avaxUsd;
  if (Number.isNaN(usd)) return undefined;
  // An empty bucket needs no fiat gloss: "$0.00" under "0 AVAX / 0.0%" is
  // three ways of saying nothing.
  if (usd === 0) return undefined;
  // Sub-cent holdings are common on P-Chain change UTXOs; "<$0.01" beats
  // rounding them to nothing.
  if (usd > 0 && usd < 0.01) return "<$0.01";
  return `$${usd.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function timeAgo(unixSecs: number | undefined): string {
  if (!unixSecs) return "—";
  const s = Math.floor(Date.now() / 1000 - unixSecs);
  if (s < 0) return "in the future";
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

export function formatTime(unixSecs: number | undefined): string {
  if (!unixSecs) return "—";
  return new Date(unixSecs * 1000).toISOString().replace("T", " ").slice(0, 19) + " UTC";
}

/** Middle-truncate a hash/address: "2VLRYb…xNxj" */
/** "5s", "2m", "1h", "3d": the age without its "ago", for an Age column */
export function ageShort(unixSecs: number): string {
  const s = Math.max(0, Math.floor(Date.now() / 1000 - unixSecs));
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86400)}d`;
}

export function truncate(v: string | undefined, len = 10): string {
  if (!v) return "";
  if (v.length <= len + 6) return v;
  return `${v.slice(0, len)}…${v.slice(-4)}`;
}

export function formatBytes(n: number | undefined): string {
  if (n === undefined) return "—";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

/** list-cell time: relative age only while it's under a day*/
export function ageOrDate(ts: number): { text: string; title: string } {
  const iso = new Date(ts * 1000).toISOString();
  const ageSeconds = Date.now() / 1000 - ts;
  return {
    text: ageSeconds > 86400 ? iso.slice(0, 10) : timeAgo(ts),
    title: iso.replace("T", " ").slice(0, 19) + " UTC",
  };
}

/* ---- human dates for charts: every axis and tooltip speaks these ---- */

const asDate = (d: string | number): Date =>
  typeof d === "number" ? new Date(d * 1000) : /^\d{4}-\d{2}-\d{2}$/.test(d) ? new Date(`${d}T00:00:00Z`) : new Date(d.length === 16 ? `${d}:00Z` : d);

/** "Aug 26": an axis tick */
export function dayShort(d: string | number): string {
  const t = asDate(d);
  return Number.isNaN(t.getTime()) ? String(d) : t.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
}

/** "Tue, Aug 26, 2026": a tooltip's day */
export function dayLong(d: string | number): string {
  const t = asDate(d);
  return Number.isNaN(t.getTime())
    ? String(d)
    : t.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
}

/** "Tue, Aug 26 · 14:00 UTC": a tooltip's hour, from "2026-08-26T14:00" or unix seconds */
export function hourLong(d: string | number): string {
  const t = asDate(d);
  if (Number.isNaN(t.getTime())) return String(d);
  const day = t.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" });
  return `${day} · ${String(t.getUTCHours()).padStart(2, "0")}:00 UTC`;
}
