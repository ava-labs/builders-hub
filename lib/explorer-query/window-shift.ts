/* A window the page can move with no model. An answer whose SQL reads one window that runs to now (the last 6
   hours, this week) can be read again over another span, and over the period before it, by writing the window's
   start again: nothing else in the query changes but the bucket a series counts in. A query with two windows, a
   date written out, or a window that does not run to now is left alone. The SQL here is the shorthand form
   (collapseMacros), as the writer typed it. */

import { sqlWindow } from "./scope";

/** the spans a window button asks for, each with the bucket a series counts in over it and that bucket's words */
export const SPANS = [
  { key: "24h", label: "24H", interval: "INTERVAL 24 HOUR", bucket: "toStartOfFifteenMinutes", per: "15 minutes", each: null },
  { key: "7d", label: "7D", interval: "INTERVAL 7 DAY", bucket: "toStartOfHour", per: "hour", each: "hourly" },
  { key: "30d", label: "30D", interval: "INTERVAL 30 DAY", bucket: "toStartOfDay", per: "day", each: "daily" },
  { key: "90d", label: "90D", interval: "INTERVAL 90 DAY", bucket: "toStartOfDay", per: "day", each: "daily" },
] as const;
export type SpanKey = (typeof SPANS)[number]["key"];

const FLOOR = String.raw`(?:toStartOf(?:Minute|FiveMinutes|FifteenMinutes|Hour|Day|Week|Month)|toMonday|toDate)`;
/** now, or the start of now's bucket, day, week or month */
const NOW = String.raw`(?:${FLOOR}\(\s*now\(\s*\)\s*(?:,\s*\d\s*)?\)|now\(\s*\)|today\(\s*\))`;
const UNITS = "MINUTE|HOUR|DAY|WEEK|MONTH";
/** where a window that runs to now starts: now less a span, or the start of now's day, week or month */
const START = String.raw`${NOW}(?:\s*-\s*INTERVAL\s+\d+\s+(?:${UNITS})S?\b)?`;
/** a lower bound on time: a column, >= or >, and a start */
const LOWER = new RegExp(String.raw`((?:\w+\.)?\`?\w+\`?)(\s*>=?\s*)(${START})`, "gi");
/** a window shorthand's start, its first argument, with no end after it: $DEX(start) or $DEX(start, 'slug') */
const MACRO = new RegExp(String.raw`^(\s*(?:WITH\s+)?\$[A-Za-z]+\s*\(\s*)(${START})(\s*(?:,\s*'[^']*'\s*)?\))`, "i");
const PARTS = new RegExp(String.raw`^(${NOW})(?:\s*-\s*INTERVAL\s+(\d+)\s+(${UNITS})S?)?$`, "i");

/** the one window of a query that the page can move: its start as written, and the bucket its series counts in */
export interface Movable {
  start: string;
  bucket: string | null;
}

/** what the page may do with an answer's window: the span it reads now when that is one of the buttons', else its
    own name for a button of its own, and whether the period before it can be read */
export interface Moves {
  span: SpanKey | null;
  own: string | null;
  prior: boolean;
}

const same = (s: string) => s.toLowerCase().replace(/\s+/g, "");

/** the window of a query that runs to now from one start, with the bucket of the series on x; null for any other
    query (two windows, a date written out, a window that ended, a week bucket with a mode of its own) */
export function movableWindow(sql: string, x: string | undefined, now: number): Movable | null {
  const w = sqlWindow(sql, now);
  if (!w || w === "unknown" || !w.open) return null;
  const starts = [...sql.matchAll(LOWER)].map((m) => m[3]);
  const head = MACRO.exec(sql);
  if (head) starts.push(head[2]);
  if (new Set(starts.map(same)).size !== 1) return null;
  const made = x ? new RegExp(String.raw`\b(${FLOOR})\(\s*(?!now\(|')([^()]*(?:\([^()]*\)[^()]*)*)\)\s+AS\s+\`?${x.replace(/\W/g, "")}\`?(?!\w)`, "i").exec(sql) : null;
  // toStartOfWeek(t, 1) takes a mode no other bucket has
  if (made && /,/.test(made[2])) return null;
  return { start: starts[0], bucket: made ? made[1] : null };
}

/** the query with every start of its window written again */
const restart = (sql: string, lower: (column: string, op: string) => string, arg: string) =>
  sql.replace(LOWER, (_all, column: string, op: string) => lower(column, op)).replace(MACRO, (_all, head: string, _start: string, tail: string) => `${head}${arg}${tail}`);

/** a query (or its drill) over another span: the window's start written again, and its series counted in the
    bucket that fits the span */
export function withSpan(sql: string, key: SpanKey, m: Movable): string {
  const span = SPANS.find((s) => s.key === key)!;
  const start = `${m.bucket ? `${span.bucket}(now())` : "now()"} - ${span.interval}`;
  const moved = restart(sql, (column, op) => `${column}${op}${start}`, start);
  return m.bucket ? moved.replace(new RegExp(String.raw`\b${m.bucket}\(`, "gi"), `${span.bucket}(`) : moved;
}

/** the calendar period a start with no span counts from: the start of now's hour, day, week or month */
const PERIOD_OF: [RegExp, string][] = [
  [/^toStartOfHour/i, "HOUR"],
  [/^(?:toStartOfDay|toDate|today)/i, "DAY"],
  [/^(?:toMonday|toStartOfWeek)/i, "WEEK"],
  [/^toStartOfMonth/i, "MONTH"],
];

/** the query over the period before its window, of the same length: the last 7 days become the 7 days before them,
    and this week so far becomes last week up to the same point. Null for a window with no period before it to read */
export function priorSql(sql: string, m: Movable): string | null {
  const p = PARTS.exec(m.start.trim());
  if (!p) return null;
  const [base, n, unit] = [p[1], p[2], p[3]?.toUpperCase()];
  let from: string;
  let to: string;
  if (n) {
    from = `${base} - INTERVAL ${2 * Number(n)} ${unit}`;
    to = `now() - INTERVAL ${n} ${unit}`;
  } else {
    const period = PERIOD_OF.find(([re]) => re.test(base))?.[1];
    if (!period) return null;
    // a month has no fixed length: the month before is the month of now less a month
    from = period === "MONTH" ? "toStartOfMonth(now() - INTERVAL 1 MONTH)" : `${base} - INTERVAL 1 ${period}`;
    to = `now() - INTERVAL 1 ${period}`;
  }
  return restart(sql, (column, op) => `${column}${op}${from} AND ${column} < ${to}`, `${from}, ${to}`);
}

const HOURS: Record<string, number> = { MINUTE: 1 / 60, HOUR: 1, DAY: 24, WEEK: 168 };
const SPAN_HOURS: Record<number, SpanKey> = { 24: "24h", 168: "7d", 720: "30d", 2160: "90d" };
const SHORT: Record<string, string> = { MINUTE: "MIN", HOUR: "H", DAY: "D", WEEK: "W", MONTH: "MO" };
const CALENDAR: Record<string, string> = { HOUR: "THIS HOUR", DAY: "TODAY", WEEK: "THIS WEEK", MONTH: "THIS MONTH" };

/** the window as the buttons know it: one of their spans, or a short name of its own (6H, TODAY) */
export function movesOf(m: Movable): Moves {
  const prior = priorSql("", m) !== null;
  const p = PARTS.exec(m.start.trim());
  const [n, unit] = [p?.[2], p?.[3]?.toUpperCase()];
  if (n && unit) {
    const span = HOURS[unit] ? SPAN_HOURS[Number(n) * HOURS[unit]] : undefined;
    return { span: span ?? null, own: span ? null : `${n}${SHORT[unit]}`, prior };
  }
  const period = p ? PERIOD_OF.find(([re]) => re.test(p[1]))?.[1] : undefined;
  return { span: null, own: period ? CALENDAR[period] : null, prior };
}

const PER = /\bper (?:\d+[- ])?(?:second|minute|hour|day|week|month)s?\b/gi;
const EACH = /\b(hourly|daily|weekly|monthly)\s+(\w+)/gi;
const LONG = /\b(?:\d+[- ])?(?:second|minute|hour|day|week|month)(?=\s+(?:period|bucket)s?\b)/gi;
/** a figure named for one bucket (Peak 5 minutes, Busiest hour), and a drill's bucket (the 5 minutes from) */
const ONE = /\b(peak|busiest|quietest|top|largest|biggest|highest|lowest|best|worst)\s+(?:\d+[- ])?(?:second|minute|hour|day|week|month)s?\b/gi;
const FROM = /\bthe (?:\d+[- ])?(?:second|minute|hour|day|week|month)s?(?=\s+(?:from|of|starting|beginning)\b)/gi;

/** a title, a note or a label in the words of a span's bucket: per 5 minutes becomes per hour, daily becomes hourly */
export function bucketWords(text: string, key: SpanKey): string {
  const span = SPANS.find((s) => s.key === key)!;
  const [n, unit] = span.per.includes(" ") ? span.per.split(" ") : ["", span.per];
  return text
    .replace(PER, `per ${span.per}`)
    .replace(ONE, (_all, word: string) => `${word} ${span.per}`)
    .replace(FROM, `the ${span.per}`)
    .replace(LONG, n ? `${n}-${unit.replace(/s$/, "")}` : unit)
    .replace(EACH, (_all, each: string, noun: string) => (span.each ? `${/^[A-Z]/.test(each) ? span.each.charAt(0).toUpperCase() + span.each.slice(1) : span.each} ${noun}` : `${noun} per ${span.per}`));
}
