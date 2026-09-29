/* A window that ends now cuts through buckets at both ends: the first
   bucket can begin before the window does, and the last one is still
   filling. The chart labels them and the reading is told which they are,
   from this one reading of the query's window. */

/** a UTC time as the rows write it (2026-09-27 00:30:00, or a day), in ms */
export const msOf = (v: unknown) => (typeof v === "string" && /^\d{4}-\d{2}-\d{2}/.test(v) ? Date.parse(v.length > 10 ? `${v.replace(" ", "T")}Z` : `${v}T00:00:00Z`) : NaN);

/** how far the index may run behind the reader's clock before its window is named in the reader's dates: past a
    day, the "today" of an index that ended long ago is not the reader's today, and its last bucket fills no more */
export const STALE_MS = 86_400_000;

const SPAN_MS: Record<string, number> = { MINUTE: 60_000, HOUR: 3_600_000, DAY: 86_400_000, WEEK: 604_800_000, MONTH: 2_592_000_000 };
/** the bucket a window's start is rounded down to: toStartOfDay(now()) starts at a midnight */
const FLOOR_MS: Record<string, number> = { tostartofminute: 60_000, tostartoffiveminutes: 300_000, tostartoffifteenminutes: 900_000, tostartofhour: 3_600_000, tostartofday: 86_400_000, todate: 86_400_000, today: 86_400_000 };
/** now() - INTERVAL 7 DAY, toStartOfDay(now()) - INTERVAL 7 DAY, today() - 7 */
const WINDOW = /\b(?:(toStartOf(?:Minute|FiveMinutes|FifteenMinutes|Hour|Day)|toDate)\(\s*now\(\s*\)\s*\)|(today)\(\s*\)|now\(\s*\))\s*-\s*(?:INTERVAL\s+(\d+)\s+(MINUTE|HOUR|DAY|WEEK|MONTH)S?\b|(\d+)\b)/i;

/* A calendar window that runs to now, with nothing taken off its start: block_time >= toStartOfMonth(now()),
   toMonday(now()), toStartOfWeek(now(), 1), toStartOfDay(now()), today(). These are "this month", "this week" and
   "today", and WINDOW has no subtraction to read in them: the audit's V11 (GUNZ this month) had no Edges line, so its
   layout averaged today's 9.9 hours as a day */
const CALENDAR = /(?:>=|>)\s*(?:(toStartOf(?:Minute|FiveMinutes|FifteenMinutes|Hour|Day|Week|Month|Quarter|Year)|toMonday|toDate)\(\s*now\(\s*\)\s*(?:,\s*(\d)\s*)?\)|(today)\(\s*\))(?!\s*[-+])/i;

/** where a calendar window starts, in the moment it ends in (UTC) */
function calendarStart(fn: string, mode: string | undefined, end: number): number {
  const f = fn.toLowerCase();
  const d = new Date(end);
  const [y, m] = [d.getUTCFullYear(), d.getUTCMonth()];
  if (f === "tostartofmonth") return Date.UTC(y, m, 1);
  if (f === "tostartofquarter") return Date.UTC(y, m - (m % 3), 1);
  if (f === "tostartofyear") return Date.UTC(y, 0, 1);
  // 1970-01-01 was a Thursday. toMonday and an odd toStartOfWeek mode start on Monday; the default mode on Sunday
  const day = Math.floor(end / SPAN_MS.DAY);
  if (f === "tomonday" || (f === "tostartofweek" && Number(mode ?? 0) % 2 === 1)) return (day - ((day + 3) % 7)) * SPAN_MS.DAY;
  if (f === "tostartofweek") return (day - ((day + 4) % 7)) * SPAN_MS.DAY;
  const floor = FLOOR_MS[f] ?? SPAN_MS.DAY;
  return Math.floor(end / floor) * floor;
}

/** where a query's window starts and ends, in ms, when it ends now; null when the SQL has no such window */
export function windowOf(sql: string, anchor?: string | null, now = Date.now()): { start: number; end: number } | null {
  const w = WINDOW.exec(sql);
  const end = anchor ? msOf(anchor) : now;
  if (!Number.isFinite(end)) return null;
  if (!w) {
    const c = CALENDAR.exec(sql);
    return c ? { start: calendarStart(c[1] ?? c[3], c[2], end), end } : null;
  }
  // a bare number counts days only from a date: now() - 7 is seven seconds
  if (w[5] && !w[2] && !/^toDate$/i.test(w[1] ?? "")) return null;
  const floor = FLOOR_MS[(w[1] ?? w[2] ?? "").toLowerCase()];
  const from = floor ? Math.floor(end / floor) * floor : end;
  return { start: from - (w[3] ? Number(w[3]) * SPAN_MS[w[4].toUpperCase()] : Number(w[5]) * SPAN_MS.DAY), end };
}

/** the rows that hold a series' first and last buckets, and whether the window cuts each: the first when it
    begins before the window, the last while it is still filling */
export function edgesOf(xs: unknown[], win: { start: number; end: number }): { lo: number; hi: number; first: boolean; last: boolean } | null {
  const ms = xs.map(msOf);
  if (ms.length < 3 || ms.some((t) => !Number.isFinite(t))) return null;
  // a bucket is the smallest step between times
  const times = [...new Set(ms)].sort((p, q) => p - q);
  let step = Infinity;
  for (let i = 1; i < times.length; i++) step = Math.min(step, times[i] - times[i - 1]);
  if (!Number.isFinite(step)) return null;
  const [t0, t1] = [times[0], times[times.length - 1]];
  return { lo: ms.indexOf(t0), hi: ms.indexOf(t1), first: t0 < win.start - 1000 && t0 + step > win.start, last: t1 + step > win.end + 1000 };
}
