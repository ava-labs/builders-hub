const SECOND = 1000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/**
 * Format a timestamp as a compact relative time ("just now", "12s ago",
 * "3m ago", "1h ago", "2d ago"). Falls back to ISO date for older values.
 */
export function formatRelativeTime(timestampMs: number, nowMs: number = Date.now()): string {
  const delta = Math.max(0, nowMs - timestampMs);

  if (delta < 5 * SECOND) return 'just now';
  if (delta < MINUTE) return `${Math.round(delta / SECOND)}s ago`;
  if (delta < HOUR) return `${Math.round(delta / MINUTE)}m ago`;
  if (delta < DAY) return `${Math.round(delta / HOUR)}h ago`;
  if (delta < 7 * DAY) return `${Math.round(delta / DAY)}d ago`;
  return new Date(timestampMs).toISOString().slice(0, 10);
}
