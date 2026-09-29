/* The window an answer reads, and the words its title and note give it. A title that says "this week" over the
   week of September 21, or a note that says the chart starts on Monday of this week over twelve weeks, names a
   window the query does not read. The window comes from the query's own bounds, or else from the rows' time
   range, never from the question's words. */

import { msOf, STALE_MS } from "./edges";

const MINUTE = 60_000;
const HOUR = 3_600_000;
const DAY = 86_400_000;
const WEEK = 7 * DAY;
/** the day after the C-Chain's first: a bound this early reads the whole history, as the DEX pools do beside the window */
const FIRST = Date.UTC(2020, 8, 24);

/** a stretch of UTC time, open when it runs to now. A rolling window starts at now less a span (the last 7 days);
    a window read off the rows is only as sharp as their bucket */
export interface Window {
  start: number;
  end: number;
  open: boolean;
  rolling?: boolean;
  grain?: number;
}

const dayOf = (t: number) => Math.floor(t / DAY) * DAY;
const mondayOf = (t: number) => dayOf(t) - ((new Date(t).getUTCDay() + 6) % 7) * DAY;
const sundayOf = (t: number) => dayOf(t) - new Date(t).getUTCDay() * DAY;
const monthOf = (t: number, back = 0) => Date.UTC(new Date(t).getUTCFullYear(), new Date(t).getUTCMonth() - back, 1);
const yearOf = (t: number) => Date.UTC(new Date(t).getUTCFullYear(), 0, 1);
const floorTo = (ms: number) => (t: number) => Math.floor(t / ms) * ms;

/* ------------------------------------------------------------------ */
/* The query's bounds */

const START_OF: Record<string, (t: number) => number> = {
  todate: dayOf,
  tostartofday: dayOf,
  tomonday: mondayOf,
  tostartofmonth: (t) => monthOf(t),
  tostartofquarter: (t) => Date.UTC(new Date(t).getUTCFullYear(), Math.floor(new Date(t).getUTCMonth() / 3) * 3, 1),
  tostartofyear: yearOf,
  tostartofhour: floorTo(HOUR),
  tostartoffifteenminutes: floorTo(15 * MINUTE),
  tostartoffiveminutes: floorTo(5 * MINUTE),
  tostartofminute: floorTo(MINUTE),
};
const UNIT_MS: Record<string, number> = { SECOND: 1000, MINUTE, HOUR, DAY, WEEK };
const UNIT_MONTHS: Record<string, number> = { MONTH: 1, QUARTER: 3, YEAR: 12 };

/** a date written out: '2026-09-21', toDate('2026-09-21'), toDateTime('2026-09-21 00:00:00') */
const LIT = String.raw`(?:to(?:Date|DateTime|DateTime64)\(\s*'\d{4}-\d{2}-\d{2}[^']*'\s*(?:,[^)]*)?\)|'\d{4}-\d{2}-\d{2}(?:[ T][\d:.]+)?')`;
const FN = String.raw`to(?:Date|Monday|StartOf(?:Day|Hour|Minute|FiveMinutes|FifteenMinutes|Week|Month|Quarter|Year))`;
/** a time as the SQL writes it: now(), today(), a date, or the start of now's (or a date's) day, week, month or year */
const BASE = String.raw`(?:now\(\s*\)|today\(\s*\)|${FN}\(\s*(?:now\(\s*\)|${LIT})\s*(?:,\s*\d\s*)?\)|${LIT})`;
/** ... less or plus intervals, or days from a date */
const TIME = String.raw`${BASE}(?:\s*[-+]\s*(?:INTERVAL\s+\d+\s+[A-Za-z]+|\d+\b))*`;
const BOUND = new RegExp(String.raw`(>=|>|<=|<)\s*(${TIME})|\bBETWEEN\s+(${TIME})\s+AND\s+(${TIME})`, "gi");
/** a bound on a table's own time column that none of these forms reads: the window is then not known */
const TIME_COLUMN = /\b(?:\w+\.)?(?:block_time|block_timestamp|snapshot_time|observed_at)\b\s*\)?\s*(?:>=|>|<=|<)\s*/gi;
const TIME_AT = new RegExp(`^(?:${TIME})`, "i");
const LIT_VALUE = /'(\d{4}-\d{2}-\d{2}[^']*)'/;
const STEP = /^\s*([-+])\s*(?:INTERVAL\s+(\d+)\s+([A-Za-z]+?)S?\b|(\d+)\b)/i;

/** a time the SQL writes, at `now`, and whether it is now less a span; NaN for anything else */
function timeOf(expr: string, now: number): { t: number; rolling: boolean } {
  const e = expr.trim();
  let t = NaN;
  let dated = false;
  let len = 0;
  let head: RegExpExecArray | null;
  if ((head = /^now\(\s*\)/i.exec(e))) t = now;
  else if ((head = /^today\(\s*\)/i.exec(e))) [t, dated] = [dayOf(now), true];
  else if ((head = new RegExp(String.raw`^(${FN})\(\s*(now\(\s*\)|${LIT})\s*(?:,\s*(\d)\s*)?\)`, "i").exec(e)) && !/^to(?:Date|DateTime)\(\s*'/i.test(e)) {
    const fn = head[1].toLowerCase();
    const at = /^now/i.test(head[2]) ? now : msOf(LIT_VALUE.exec(head[2])?.[1]);
    // toStartOfWeek counts from Sunday unless its mode is 1
    const start = fn === "tostartofweek" ? (head[3] === "1" ? mondayOf : sundayOf) : START_OF[fn];
    t = start ? start(at) : NaN;
    dated = fn === "todate" || fn === "tostartofday";
  } else if ((head = new RegExp(`^${LIT}`, "i").exec(e))) [t, dated] = [msOf(LIT_VALUE.exec(head[0])?.[1]), true];
  if (!head || !Number.isFinite(t)) return { t: NaN, rolling: false };
  len = head[0].length;
  const base = head[0];
  let rest = e.slice(len);
  let back = false;
  for (let s = STEP.exec(rest); s; s = STEP.exec(rest)) {
    const sign = s[1] === "-" ? -1 : 1;
    const unit = s[3]?.toUpperCase();
    // a date counts bare numbers as days; now() - 7 is seven seconds, and no window
    if (s[4] !== undefined) {
      if (!dated) return { t: NaN, rolling: false };
      t += sign * Number(s[4]) * DAY;
    } else if (UNIT_MS[unit]) t += sign * Number(s[2]) * UNIT_MS[unit];
    else if (UNIT_MONTHS[unit]) {
      const d = new Date(t);
      d.setUTCMonth(d.getUTCMonth() + sign * Number(s[2]) * UNIT_MONTHS[unit]);
      t = d.getTime();
    } else return { t: NaN, rolling: false };
    back ||= sign < 0;
    rest = rest.slice(s[0].length);
  }
  if (rest.trim()) return { t: NaN, rolling: false };
  return { t, rolling: /^now/i.test(base) && back };
}

/** a date-only upper bound written with <= or BETWEEN takes in its whole day */
const wholeDay = (expr: string) => /^(?:'\d{4}-\d{2}-\d{2}'|toDate\(\s*'\d{4}-\d{2}-\d{2}'\s*\))$/i.test(expr.trim());
/** an end at now, or an hour or less before it, only keeps clear of the newest rows: it is no end */
const nearNow = (expr: string) => /^now\(\s*\)(?:\s*-\s*INTERVAL\s+(?:\d+\s+(?:SECOND|MINUTE)S?|1\s+HOURS?))?\s*$/i.test(expr.trim());

/** a shorthand the query opens with (macros.ts), a quoted slug among its arguments, and those that take a window */
const HEAD = /^\s*(?:WITH\s+)?\$([A-Za-z]+)\s*\(/;
const SLUG = /^'[a-z][\w-]*'$/i;
const WINDOWED = /^(?:DEX|LEND|LIQUIDATIONS|PRICES)$/i;

/** the query with a window shorthand's start and end written as bounds in its place: the WITH it stands for reads
    further back than its window (a price from the hour before, a debt's last 30 days), in forms this cannot read */
function unshort(code: string): string {
  const head = HEAD.exec(code);
  if (!head) return code;
  // its arguments run to the parenthesis that closes the first one, split at its own commas, outside strings
  const blank = code.replace(/'(?:[^'\\]|\\.)*'/g, (s) => `'${" ".repeat(s.length - 2)}'`);
  const open = head[0].length - 1;
  const cuts: number[] = [];
  let close = -1;
  for (let i = open, depth = 0; i < blank.length && close < 0; i++) {
    if (blank[i] === "(") depth++;
    else if (blank[i] === ")" && --depth === 0) close = i;
    else if (blank[i] === "," && depth === 1) cuts.push(i);
  }
  if (close < 0) return code;
  const args = [open, ...cuts].map((at, j) => code.slice(at + 1, cuts[j] ?? close).trim());
  const [start, end] = WINDOWED.test(head[1]) ? args.filter((a) => a && !SLUG.test(a)) : [];
  return [start && `block_time >= ${start}`, end && `block_time < ${end}`, code.slice(close + 1)].filter(Boolean).join(" AND ");
}

/** the window the query reads, from its own bounds on time: null when it has none; "unknown" when it reads one of
    them in a form this cannot read, or reads several windows (a comparison of two periods). A bound an hour before
    another is padding (the price of the hour before), and a bound at the chain's first day beside a later one reads
    the DEX pools' history, not the answer's window. A window shorthand's window is its own start and end */
export function sqlWindow(sql: string, now: number): Window | "unknown" | null {
  const code = unshort(sql.replace(/--[^\n]*/g, "").replace(/\/\*[\s\S]*?\*\//g, ""));
  for (const m of code.matchAll(TIME_COLUMN)) if (!TIME_AT.test(code.slice((m.index ?? 0) + m[0].length)) && !/^BETWEEN\b/i.test(code.slice((m.index ?? 0) + m[0].length))) return "unknown";
  const lows: { t: number; rolling: boolean }[] = [];
  const highs: number[] = [];
  const high = (expr: string, inclusive: boolean) => {
    if (nearNow(expr)) return;
    highs.push(timeOf(expr, now).t + (inclusive && wholeDay(expr) ? DAY : 0));
  };
  for (const m of code.matchAll(BOUND)) {
    if (m[3] !== undefined) {
      lows.push(timeOf(m[3], now));
      high(m[4], true);
    } else if (m[1].startsWith(">")) lows.push(timeOf(m[2], now));
    else high(m[2], m[1] === "<=");
  }
  if (lows.some((l) => !Number.isFinite(l.t)) || highs.some((h) => !Number.isFinite(h))) return "unknown";
  let lo = lows.filter((v) => !lows.some((w) => w.t > v.t && w.t - v.t <= HOUR));
  if (lo.some((v) => v.t > FIRST)) lo = lo.filter((v) => v.t > FIRST);
  const starts = [...new Set(lo.map((v) => Math.round(v.t / 1000)))];
  const ends = [...new Set(highs.filter((v) => v < now - MINUTE).map((v) => Math.round(v / 1000)))];
  if (!starts.length) return null;
  if (starts.length > 1 || ends.length > 1) return "unknown";
  const start = starts[0] * 1000;
  const rolling = lo.some((v) => v.rolling);
  if (!ends.length) return start < now ? { start, end: now, open: true, rolling } : null;
  const end = ends[0] * 1000;
  return end > start ? { start, end, open: false, rolling } : null;
}

/** the window the rows cover when their x is a time: the first bucket to the end of the last */
export function rowsWindow(rows: readonly Record<string, unknown>[], x: string | undefined, now: number): Window | null {
  if (!x) return null;
  const times = [...new Set(rows.map((r) => msOf(r[x])))].sort((p, q) => p - q);
  if (times.length < 2 || times.some((t) => !Number.isFinite(t))) return null;
  let step = Infinity;
  for (let i = 1; i < times.length; i++) step = Math.min(step, times[i] - times[i - 1]);
  const start = times[0];
  const end = times[times.length - 1] + step;
  return end >= now ? { start, end: now, open: true, grain: step } : { start, end, open: false, grain: step };
}

/* ------------------------------------------------------------------ */
/* The words */

const MONTHS = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];
const MONTH = String.raw`(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sept?(?:ember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)`;
/** a date as a title or a note writes it, a weekday before it or not: Monday September 21, Sep 21, 2026, Monday 2026-09-21 */
const DATE = String.raw`(?:(?:(?:mon|tues|wednes|thurs|fri|satur|sun)day,?\s+)?(?:${MONTH}\.?\s+\d{1,2}(?:st|nd|rd|th)?(?:,?\s+\d{4})?|\d{4}-\d{2}-\d{2}))`;
const NUMS: Record<string, number> = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, fourteen: 14, fifteen: 15, twenty: 20, "twenty-four": 24, thirty: 30, sixty: 60, ninety: 90 };
const NUM = String.raw`(\d+|${Object.keys(NUMS).sort((p, q) => q.length - p.length).join("|")})`;
const numOf = (s: string) => NUMS[s.toLowerCase()] ?? Number(s);
const UNIT: Record<string, number> = { minute: MINUTE, hour: HOUR, day: DAY, week: WEEK, month: 30 * DAY, year: 365 * DAY };

/** a date the text writes, in the year of now unless it names one (a date more than two days ahead is last year's) */
function dateOf(text: string, now: number): number {
  const iso = /(\d{4}-\d{2}-\d{2})/.exec(text);
  if (iso) return msOf(iso[1]);
  const m = new RegExp(String.raw`(${MONTH})\.?\s+(\d{1,2})(?:st|nd|rd|th)?(?:,?\s+(\d{4}))?`, "i").exec(text);
  if (!m) return NaN;
  const month = MONTHS.findIndex((n) => n.startsWith(m[1].toLowerCase().slice(0, 3)));
  const year = m[3] ? Number(m[3]) : new Date(now).getUTCFullYear();
  const t = Date.UTC(year, month, Number(m[2]));
  return !m[3] && t > now + 2 * DAY ? Date.UTC(year - 1, month, Number(m[2])) : t;
}

/** where a phrase starts the window: a date it writes, or the start of now's week, month, year or day */
function startOf(what: string, now: number): number {
  const date = dateOf(what, now);
  if (Number.isFinite(date)) return date;
  return /week|monday/i.test(what) ? mondayOf(now) : /month/i.test(what) ? monthOf(now) : /year/i.test(what) ? yearOf(now) : dayOf(now);
}

type Kind = "whole" | "start" | "mention";
interface Claim {
  from: number;
  to: number;
  text: string;
  kind: Kind;
  tol: number;
  windows: Window[];
}
/** a phrase that names a window: the windows it may mean at `now`, how near a query's window must come, and whether
    it names the whole window, only its start, or (a calendar word in a note) a time the window holds. A rolling
    phrase names the window in a note only after a preposition: "the last day may be incomplete" names a bucket */
type Rule = { re: RegExp; kind: Kind | "calendar"; prep?: boolean; of: (m: RegExpExecArray, now: number) => { windows: Window[]; tol: number } };
const open = (start: number, now: number): Window => ({ start, end: now, open: true });
const shut = (start: number, end: number): Window => ({ start, end, open: false });
const rolling = (n: number, unit: string, now: number) => {
  const span = n * UNIT[unit];
  return { windows: [open(now - span, now)], tol: Math.min(unit === "month" ? 31 * DAY : UNIT[unit], span / 4) };
};
const RULES: Rule[] = [
  // the chart's own start, not each week's (a week starting Monday)
  { re: new RegExp(String.raw`\b(?:chart|window|data|series|query|range|period|history)\s+(?:starts?|started|begins?|began)\s+(?:on\s+|at\s+|from\s+|in\s+)?(?:the\s+)?(${DATE}|monday(?:\s+of\s+this\s+week)?|this\s+week|this\s+month|today|midnight)`, "gi"), kind: "start", of: (m, now) => ({ windows: [open(startOf(m[1], now), now)], tol: HOUR }) },
  // a weekday's date is the start it names: since Monday 2026-09-21 starts on the 21st, whatever this week is
  { re: new RegExp(String.raw`\bsince\s+(?:the\s+start\s+of\s+(?:the\s+|this\s+)?(day|week|month|year)|(${DATE}|monday|midnight))`, "gi"), kind: "whole", of: (m, now) => ({ windows: [open(startOf(m[1] ?? m[2], now), now)], tol: HOUR }) },
  { re: new RegExp(String.raw`\b(?:(?:in|over|during|for|across|within)\s+)?(?:the\s+)?(?:last|past|previous|prior)\s+${NUM}\s+(minute|hour|day|week|month)s?\b`, "gi"), kind: "whole", prep: true, of: (m, now) => rolling(numOf(m[1]), m[2].toLowerCase(), now) },
  { re: /\b(?:(?:in|over|during|for|across|within)\s+)?the\s+(?:last|past)\s+(hour|day|week|month|year)\b/gi, kind: "whole", prep: true, of: (m, now) => {
      const r = rolling(1, m[1].toLowerCase(), now);
      // the past week may mean the calendar week before this one, or the 7 days to now
      if (/week/i.test(m[1])) r.windows.push(shut(mondayOf(now) - WEEK, mondayOf(now)), open(mondayOf(now) - WEEK, now));
      return r;
    } },
  { re: new RegExp(String.raw`\b(?:a\s+|the\s+)?(?:rolling\s+${NUM}[-\s]day|${NUM}[-\s]day\s+rolling)\b`, "gi"), kind: "whole", of: (m, now) => rolling(numOf(m[1] ?? m[2]), "day", now) },
  { re: new RegExp(String.raw`\b(?:(?:in|for|during|over)\s+)?the\s+week\s+(?:of|starting|beginning)\s+(${DATE})`, "gi"), kind: "whole", of: (m, now) => ({ windows: [shut(mondayOf(dateOf(m[1], now)), mondayOf(dateOf(m[1], now)) + WEEK)], tol: HOUR }) },
  { re: new RegExp(String.raw`\b(?:from|between)\s+(${DATE})\s+(?:to|and|through|until)\s+(${DATE})`, "gi"), kind: "whole", of: (m, now) => {
      const [p, q] = [dateOf(m[1], now), dateOf(m[2], now)];
      return { windows: [shut(p, q), shut(p, q + DAY)], tol: HOUR };
    } },
  { re: /\b(?:so\s+far\s+)?today\b/gi, kind: "calendar", of: (_m, now) => ({ windows: [open(dayOf(now), now)], tol: HOUR }) },
  { re: /\byesterday\b/gi, kind: "calendar", of: (_m, now) => ({ windows: [shut(dayOf(now) - DAY, dayOf(now))], tol: HOUR }) },
  { re: /\b(?:this|the\s+current)\s+week\b/gi, kind: "calendar", of: (_m, now) => ({ windows: [open(mondayOf(now), now)], tol: HOUR }) },
  { re: /\blast\s+week\b/gi, kind: "calendar", of: (_m, now) => ({ windows: [shut(mondayOf(now) - WEEK, mondayOf(now)), open(now - WEEK, now), open(mondayOf(now) - WEEK, now)], tol: HOUR }) },
  { re: /\b(?:this|the\s+current)\s+month\b/gi, kind: "calendar", of: (_m, now) => ({ windows: [open(monthOf(now), now)], tol: HOUR }) },
  { re: /\blast\s+month\b/gi, kind: "calendar", of: (_m, now) => ({ windows: [shut(monthOf(now, 1), monthOf(now)), open(now - 30 * DAY, now)], tol: DAY }) },
  { re: /\bthis\s+year\b/gi, kind: "calendar", of: (_m, now) => ({ windows: [open(yearOf(now), now)], tol: HOUR }) },
  { re: new RegExp(String.raw`\bon\s+(${DATE})`, "gi"), kind: "calendar", of: (m, now) => ({ windows: [shut(dateOf(m[1], now), dateOf(m[1], now) + DAY)], tol: HOUR }) },
  // any other date: a title's names its day, and a note's falls inside the window
  { re: new RegExp(String.raw`\b(${DATE})`, "gi"), kind: "calendar", of: (m, now) => ({ windows: [shut(dateOf(m[1], now), dateOf(m[1], now) + DAY)], tol: HOUR }) },
];
const PREP = /^(?:in|over|during|for|across|within)\s/i;

/** the phrases in a title or a note that name a window */
function claimsOf(text: string, where: "title" | "note", now: number): Claim[] {
  const out: Claim[] = [];
  for (const rule of RULES) {
    for (const m of text.matchAll(rule.re)) {
      const from = m.index ?? 0;
      const to = from + m[0].length;
      if (out.some((c) => from < c.to && to > c.from)) continue;
      if (where === "note" && rule.prep && !PREP.test(m[0])) continue;
      const { windows, tol } = rule.of(m as RegExpExecArray, now);
      if (windows.some((w) => !Number.isFinite(w.start) || !Number.isFinite(w.end))) continue;
      out.push({ from, to, text: m[0], kind: rule.kind === "calendar" ? (where === "title" ? "whole" : "mention") : rule.kind, tol, windows });
    }
  }
  return out.sort((p, q) => p.from - q.from);
}

/** whether a phrase fits the window the query reads */
function fits(c: Claim, w: Window): boolean {
  const tol = Math.max(c.tol, w.grain ?? 0);
  return c.windows.some((p) => {
    if (c.kind === "start") return Math.abs(p.start - w.start) <= tol;
    // a time the window holds: the two overlap
    if (c.kind === "mention") return p.start < w.end - MINUTE && p.end > w.start + MINUTE;
    return Math.abs(p.start - w.start) <= tol && ((p.open && w.open) || Math.abs(p.end - w.end) <= tol);
  });
}

/** a title or a note sentence that sets two periods side by side names more than one window */
const COMPARES = /\b(?:vs\.?|versus|compared|than|against|before|earlier)\b/i;
const sentences = (text: string) => text.split(/(?<=[.!?])\s+/);

const dayWords = (t: number, now: number) => {
  const d = new Date(t);
  const day = `${MONTHS[d.getUTCMonth()][0].toUpperCase()}${MONTHS[d.getUTCMonth()].slice(1)} ${d.getUTCDate()}`;
  return d.getUTCFullYear() === new Date(now).getUTCFullYear() ? day : `${day}, ${d.getUTCFullYear()}`;
};
const timeWords = (t: number, now: number) => (t % DAY === 0 ? dayWords(t, now) : `${dayWords(t, now)}, ${new Date(t).toISOString().slice(11, 16)} UTC`);

/** the window in the words a title uses: today, this week, in the last 7 days, in the week of September 21 */
export function windowWords(w: Window, now: number): string {
  const near = (p: number, q: number) => Math.abs(p - q) <= Math.max(MINUTE, w.grain ?? 0);
  if (w.open) {
    if (w.rolling) {
      // one week reads as 7 days, and one day as 24 hours
      for (const [unit, ms] of [["week", WEEK], ["day", DAY], ["hour", HOUR], ["minute", MINUTE]] as const) {
        const n = Math.round((now - w.start) / ms);
        if (n === 1 && unit !== "hour" && unit !== "minute") continue;
        if (n >= 1 && near(w.start, now - n * ms)) return n === 1 ? `in the last ${unit}` : `in the last ${n} ${unit}s`;
      }
    }
    if (near(w.start, dayOf(now))) return "today";
    if (near(w.start, mondayOf(now))) return "this week";
    if (near(w.start, monthOf(now))) return "this month";
    if (near(w.start, yearOf(now))) return "this year";
    if (w.start <= FIRST) return "since the chain began";
    return `since ${timeWords(w.start, now)}`;
  }
  if (w.start % DAY === 0 && w.end - w.start === DAY) return `on ${dayWords(w.start, now)}`;
  if (w.start === mondayOf(w.start) && w.end - w.start === WEEK) return `in the week of ${dayWords(w.start, now)}`;
  const last = w.end % DAY === 0 ? w.end - DAY : w.end;
  return `from ${timeWords(w.start, now)} to ${timeWords(last, now)}`;
}

/** the window as the writer is told it: its bounds in UTC */
const iso = (t: number) => new Date(t).toISOString().slice(0, 16).replace("T", " ");
const spanWords = (w: Window) => (w.open ? `${iso(w.start)} UTC to now` : `${iso(w.start)} to ${iso(w.end)} UTC`);

/** why the title or the note names a window the query does not read, for the writer; or null */
export function scopeError(title: string, note: string, w: Window, now: number): string | null {
  if (COMPARES.test(title)) return null;
  const bad = [
    ...claimsOf(title, "title", now).filter((c) => !fits(c, w)).map((c) => `the title says "${c.text}"`),
    ...sentences(note).flatMap((s) => (COMPARES.test(s) ? [] : claimsOf(s, "note", now).filter((c) => !fits(c, w)).map((c) => `the note says "${c.text}"`))),
  ];
  if (!bad.length) return null;
  return `${bad.join(" and ")}, but the query reads ${spanWords(w)} (${windowWords(w, now)}). Name the window the query reads, or fix the query if the question asks for another window, and call render_chart again.`;
}

/** a title and a note that name only the window the query reads: a wrong phrase in the title gives way to the
    window's own words, and a note sentence with one is left out */
export function scoped(text: { title: string; note: string }, w: Window, now: number): { title: string; note: string } {
  if (COMPARES.test(text.title)) return text;
  const words = windowWords(w, now);
  let title = text.title;
  for (const c of claimsOf(title, "title", now).filter((k) => !fits(k, w)).reverse()) {
    // a possessive scope (Today's swaps) moves to the end: Swaps in the last 24 hours
    if (/^['’]s\b/.test(title.slice(c.to))) title = `${title.slice(0, c.from)}${title.slice(c.to + 2)} ${words}`;
    else {
      // the window's words bring their own preposition: for this week becomes in the week of September 21
      const before = /^(?:in|on|since|from)\b/.test(words) ? title.slice(0, c.from).replace(/\b(?:in|for|during|over|on|since|from|across|within)\s+$/i, "") : title.slice(0, c.from);
      title = `${before}${words}${title.slice(c.to)}`;
    }
  }
  title = title.replace(/\s{2,}/g, " ").replace(/\s+([,.;:])/g, "$1").trim();
  // a title opens with a capital, but a name with capitals of its own keeps its case: sAVAX, not SAVAX
  if (!/^[a-z]+[A-Z]/.test(title)) title = title.charAt(0).toUpperCase() + title.slice(1);
  const note = sentences(text.note)
    .filter((s) => COMPARES.test(s) || claimsOf(s, "note", now).every((c) => fits(c, w)))
    .join(" ");
  return { title, note };
}

/** a note sentence that says its window is still running, which a stale index's window is not */
const RUNNING = /\b(?:not over|not yet over|still (?:grows?|growing|in progress|running|open)|so far|partial|in progress)\b/i;

/** the stale line a kept note holds from an earlier answer: withWindow writes it again from the index's end now */
const STALE_SAID = /^The index ends at \d{4}-\d\d-\d\d \d\d:\d\d UTC, \d+ days? ago, so the query reads up to then\.\s*/;

/** the sentence a stale index's answer opens its note with: where the index ends, and that the query reads up to it */
export function staleLine(anchor: number, clock: number): string {
  if (!Number.isFinite(anchor) || clock - anchor < STALE_MS) return "";
  const days = Math.floor((clock - anchor) / DAY);
  return `The index ends at ${iso(anchor)} UTC, ${days} ${days === 1 ? "day" : "days"} ago, so the query reads up to then.`;
}

/** a title and a note that name the window the query reads. now is the query's own now (the index's last block when
    it runs behind); clock is the reader's. An index more than STALE_MS behind has its window closed at its end and
    named in the reader's dates, loses the sentences that say the window is still running, and says where it ends
    (the L1 audit's X01 read "transactions today" as the day in March where its index ended). A calendar window
    closes at the end of the index's last day, so it reads as days: on March 25, not to March 25, 23:36 UTC */
export function withWindow(said: { title: string; note: string }, sql: string, rows: readonly Record<string, unknown>[], x: string | undefined, now: number, clock = now): { title: string; note: string } {
  const text = STALE_SAID.test(said.note) ? { ...said, note: said.note.replace(STALE_SAID, "") } : said;
  const win = sqlWindow(sql, now);
  const w = win === "unknown" ? null : (win ?? rowsWindow(rows, x, now));
  const stale = clock - now >= STALE_MS;
  if (!stale) return w ? scoped(text, w, now) : text;
  let out = text;
  if (w) {
    // a window that runs to now ends where the index ends, a calendar one at the end of that day
    const end = !w.open ? w.end : !w.rolling && w.start % DAY === 0 ? dayOf(now) + DAY : now;
    out = scoped(text, { ...w, open: false, rolling: false, end }, clock);
  }
  const note = sentences(out.note).filter((s) => s && !RUNNING.test(s)).join(" ");
  return { title: out.title, note: [staleLine(now, clock), note].filter(Boolean).join(" ") };
}
