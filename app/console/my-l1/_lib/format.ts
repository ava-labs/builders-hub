// Compact "expires in 2d 4h" / "expired" formatter for managed-node TTLs.
// Granularity is intentionally coarse — minutes-precision adds noise on a
// 3-day TTL where the user only cares whether they need to act today.
export function formatRelativeFromNow(iso: string): string {
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0) return 'expired';
  const totalHours = Math.floor(ms / 3_600_000);
  const days = Math.floor(totalHours / 24);
  const hours = totalHours % 24;
  if (days > 0) return `${days}d ${hours}h`;
  return `${hours}h`;
}

// Human-readable duration formatter for block ages and block-time
// intervals. Goal: collapse the raw seconds counter into the largest unit
// that's still informative, so "1576s ago" reads as "26m ago" and
// "8892s interval" reads as "2h 28m interval".
//
//   < 60s    → "{n}s"
//   < 60m    → "{n}m"
//   < 24h    → "{n}h" or "{n}h {m}m" when minutes carry signal
//   ≥ 24h    → "{n}d {h}h" or just "{n}d" past several days
export function formatDurationCompact(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '—';
  const s = Math.floor(seconds);
  if (s < 60) return `${s}s`;
  if (s < 3600) {
    const m = Math.floor(s / 60);
    return `${m}m`;
  }
  if (s < 86400) {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    return m > 0 ? `${h}h ${m}m` : `${h}h`;
  }
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  // Past a few days the hours field just adds clutter — most chains we
  // surface here would never reach that, but cap the format anyway.
  return d >= 4 || h === 0 ? `${d}d` : `${d}d ${h}h`;
}

// Format gas price in the most informative unit. eth_gasPrice returns wei;
// `formatEther` gives the value in eth (= 1 unit of native). Reformat to
// nAVAX when sub-microscopic so users can read it without scientific notation.
export function formatGasPrice(eth: string): string {
  const num = Number(eth);
  if (!Number.isFinite(num) || num === 0) return '—';
  if (num < 1e-9) {
    // Fewer than 1 navax-ish; show in wei.
    const wei = Math.round(num * 1e18);
    return `${wei} wei`;
  }
  if (num < 1e-6) {
    const navax = (num * 1e9).toFixed(2);
    return `${navax} nAVAX`;
  }
  return `${num.toFixed(6)} AVAX`;
}
