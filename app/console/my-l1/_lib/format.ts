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
