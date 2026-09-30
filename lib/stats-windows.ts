/* Which stats API buckets a figure reads.

   The stats API stores only complete periods, each bucket stamped with the
   start of its period (UTC; weeks start on Monday), and a period with no
   activity stores no bucket. So a figure picks its buckets by timestamp:
   the newest bucket is the latest complete period, not a partial one to
   skip, and a quiet chain's older bucket never stands in for the latest. */

export type BucketInterval = "hour" | "day" | "week" | "month";

export interface Bucket {
  timestamp: number;
  value: number;
}

const HOUR = 3600;
const DAY = 86_400;

/* how long after a period ends the index may still be storing it: in that
   time the period before stands in for it. An hour lands within minutes; a
   day was in by 00:47 UTC on 2026-09-27 */
export const SETTLE_SECONDS: Record<BucketInterval, number> = { hour: 10 * 60, day: HOUR, week: HOUR, month: HOUR };

/** the start of the period that holds `t`, both in unix seconds */
export function periodStart(t: number, interval: BucketInterval): number {
  if (interval === "hour") return Math.floor(t / HOUR) * HOUR;
  const day = Math.floor(t / DAY);
  if (interval === "day") return day * DAY;
  // 1970-01-01 was a Thursday, three days after a Monday
  if (interval === "week") return (day - ((day + 3) % 7)) * DAY;
  const d = new Date(t * 1000);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1) / 1000;
}

/**
 * The bucket of the latest complete period: the one that ended when the
 * current one began. In the first SETTLE_SECONDS of a period the one before
 * stands in when the latest is not stored yet. Null when the chain stored
 * neither: an older bucket is not the latest period's figure.
 */
export function latestComplete(buckets: Bucket[], interval: BucketInterval, now: number, settle = SETTLE_SECONDS[interval]): Bucket | null {
  const current = periodStart(now, interval);
  const latest = periodStart(current - 1, interval);
  const starts = now - current < settle ? [latest, periodStart(latest - 1, interval)] : [latest];
  for (const start of starts) {
    const hit = buckets.find((b) => b.timestamp === start);
    if (hit) return hit;
  }
  return null;
}

/**
 * The sum over the `count` complete hours or days before now. In the first
 * SETTLE_SECONDS of a period, when the one just ended is not stored yet, the
 * window ends a period earlier, so it still spans `count` stored periods.
 * Null when no bucket falls in the window.
 */
export function sumComplete(buckets: Bucket[], interval: "hour" | "day", count: number, now: number, settle = SETTLE_SECONDS[interval]): number | null {
  const step = interval === "hour" ? HOUR : DAY;
  let end = periodStart(now, interval);
  if (now - end < settle && !buckets.some((b) => b.timestamp === end - step)) end -= step;
  const start = end - count * step;
  let sum: number | null = null;
  for (const b of buckets) {
    if (b.timestamp >= start && b.timestamp < end) sum = (sum ?? 0) + (b.value || 0);
  }
  return sum;
}
