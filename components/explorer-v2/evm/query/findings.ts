/* What stands out in an answer's rows, found by rules and never by a model: a peak far above the usual period, a
   later half that runs above the earlier one, a leader's share, a mover against the period before, a part that
   fails. Each rule reads only figures that add up (column-kinds.ts), leaves a period the window cuts out of a
   series (edges.ts), and says nothing of a whole it does not hold (rows a LIMIT cut). The page shows the three
   that stand out most. Pure, so each rule is tested without a page. */

import type { ColumnMeta } from "@/lib/explorer-query/clickhouse";
import { EXTREME_NAME, MEAN_NAME, NUMERIC, RATE, distinctColumns } from "@/lib/explorer-query/column-kinds";
import { edgesOf, msOf, windowOf } from "@/lib/explorer-query/edges";
import type { ChartSpec, Names, Totals } from "@/lib/explorer-query/types";
import { isTime } from "@/lib/explorer-query/values";
import type { Format, VisualSpec } from "@/lib/explorer-query/visual-spec";
import { fmt, fmtX, spanOf, tipX, xText, zoneOf, type Span } from "../query-format";
import { changeText, priorWords, type Prior } from "./stat-figures";

type Row = Record<string, unknown>;

export type FindingKind = "peak" | "trend" | "change" | "failure" | "leader" | "concentration" | "mover" | "newcomer";

export interface Finding {
  kind: FindingKind;
  /** the word the page prints before the line */
  tag: string;
  text: string;
  /** the x value of the row the finding is about, and the row: its mark lights, and it opens as the mark does */
  key?: unknown;
  row?: Row;
  /** the direction the line reports, for its ink: a rise, a fall, a failure, or none */
  tone: "up" | "down" | "bad" | "plain";
  /** how far the finding stands out, 0 to 1: the page shows the highest */
  score: number;
  /** the question a reader asks next about it: the page offers it as a chip, and a model answers it */
  ask?: string;
}

export interface FindInput {
  columns: readonly ColumnMeta[];
  rows: readonly Row[];
  names: Names;
  visual: VisualSpec | null;
  chart: ChartSpec;
  sql: string;
  anchor?: string | null;
  /** when a LIMIT cut the rows: the whole result's figures */
  totals?: Totals | null;
  /** the same query over the period before its window, once read */
  prior?: Prior | null;
  /** the window the answer reads ("last 6 hours") */
  span?: string | null;
  sym: string;
  /** the clock, for a window that ends now */
  now?: number;
}

/** the most findings an answer shows */
export const FINDINGS = 3;

const FAILS = /(?:^|_)(?:revert\w*|fail\w*|error\w*)(?:_|$)/i;
/** a column that names what an amount is of: amounts in two tokens never add up */
const TOKEN = /(?:^|_)(?:token|symbol|asset|currency)(?:_|$)/i;
/** a figure that adds up over any rows: a count, or an amount in one unit */
const ONE_UNIT = /(?:^|_)(?:usd|avax|txs|transactions|transfers|count|blocks|calls|swaps|gas)(?:_|$)/i;

/** a series named for its period (this week, last week): the pair is a figure now and the same figure before */
const NOW_NAME = /(?:^|_)(this_week|this_month|current|today|this|cur)(?:_|$)/i;
const BEFORE_NAME = /(?:^|_)(last_week|last_month|previous_week|previous_month|prior_week|prior_month|previous|prior|yesterday|last|prev)(?:_|$)/i;
/** a list of records (transfers, transactions), each with its own time: no period holds them, so no series rule reads them */
const RECORD = /^(?:tx_?hash|hash|tx_id|transaction_hash)$/i;

const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);
const sumOf = (rows: readonly Row[], c: string) => rows.reduce((n, r) => n + (num(r[c]) ?? 0), 0);
const median = (vs: number[]) => {
  const s = [...vs].sort((p, q) => p - q);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};
/** a share or a ratio as a reader says it: 41%, 7.8%, 0.4% */
const pct = (f: number) => {
  const p = f * 100;
  return `${p >= 10 ? p.toFixed(0) : p >= 1 ? p.toFixed(1) : p.toFixed(2).replace(/0$/, "")}%`;
};
const times = (f: number) => `${f >= 10 ? f.toFixed(0) : f.toFixed(1)} times`;
/** a mean as a reader says it: whole from 100 */
const mean = (v: number) => (Math.abs(v) >= 100 ? Math.round(v) : v);
const lower = (label: string) => (/^[A-Z][a-z]/.test(label) ? label.charAt(0).toLowerCase() + label.slice(1) : label);

interface Measure {
  column: string;
  label: string;
  format: Format;
}

/** the answer's series in the order its panels draw them, each once, then any the chart alone names */
function seriesOf(input: FindInput, x: string): Measure[] {
  const out = new Map<string, Measure>();
  for (const p of input.visual?.panels ?? []) {
    if (p.kind === "table" || p.kind === "flow" || p.kind === "histogram" || p.x !== x) continue;
    for (const s of p.series) if (!out.has(s.column) && s.transform === "none") out.set(s.column, { column: s.column, label: s.label, format: s.format });
  }
  for (const s of input.chart.series) if (!out.has(s.column)) out.set(s.column, { column: s.column, label: s.label, format: "number" });
  return [...out.values()];
}

/** what stands out in the rows, the most notable first, at most FINDINGS of them */
export function findingsOf(input: FindInput): Finding[] {
  const { rows, columns, names, sym } = input;
  const x = input.visual?.panels.find((p) => p.kind !== "table" && p.kind !== "flow" && p.kind !== "histogram" && p.x)?.x ?? input.chart.x;
  if (!x || rows.length < 3 || !columns.some((c) => c.name === x)) return [];
  const numeric = new Set(columns.filter((c) => NUMERIC.test(c.type)).map((c) => c.name));
  const perRow = distinctColumns(columns, input.sql);
  const mixed = columns.some((c) => c.name !== x && TOKEN.test(c.name) && new Set(rows.map((r) => String(r[c.name]))).size > 1);
  // a figure whose rows add up to a whole: not a rate, an average, an extreme or a count of distinct ones in each row
  const addsUp = (m: Measure) =>
    numeric.has(m.column) && m.format !== "percent" && !RATE.test(m.column) && !MEAN_NAME.test(m.column) && !EXTREME_NAME.test(m.column) && !perRow.has(m.column) && (!mixed || ONE_UNIT.test(m.column)) && rows.every((r) => (num(r[m.column]) ?? 0) >= 0);
  const series = seriesOf(input, x).filter((m) => numeric.has(m.column) && m.column !== x);
  const main = series.find((m) => addsUp(m) && !FAILS.test(m.column));
  if (!main) return [];
  const fail = series.find((m) => addsUp(m) && FAILS.test(m.column)) ?? [...numeric].filter((c) => FAILS.test(c)).map((c) => ({ column: c, label: c, format: "number" as Format })).find(addsUp);
  const say = (v: number, m: Measure = main) => fmt(v, m.format, sym);
  // a series named for its period says nothing of what it counts: the figure stands alone, and a share is of the total
  const period = NOW_NAME.test(main.column);
  const what = period ? "the total" : lower(main.label);
  // a figure with what it counts after it; a figure that carries its unit ($1.2M, 3.4 AVAX, 178B gas) stands alone
  const amount = (v: number) => {
    const text = say(v);
    return period || main.format === "usd" || main.format === "avax" || main.format === "gas" || text.toLowerCase().endsWith(what.toLowerCase()) ? text : `${text} ${what}`;
  };
  const failed = fail ? (/revert/i.test(fail.column) ? "reverted" : /error/i.test(fail.column) ? "errored" : "failed") : "";
  const words = priorWords(input.span);
  const before = words.startsWith("prior") ? `the ${words}` : words;
  const prior = input.prior?.rows.length ? input.prior : null;
  const cut = (!!input.totals && input.totals.rows > rows.length) || (typeof rows[0]?.of_total === "number" && rows[0].of_total > rows.length);
  const found: Finding[] = [];

  const unique = new Set(rows.map((r) => String(r[x]))).size === rows.length;
  if (columns.some((c) => RECORD.test(c.name)) || !unique) return [];
  if (rows.every((r) => isTime(r[x]))) {
    const sorted = [...rows].sort((p, q) => String(p[x]).localeCompare(String(q[x])));
    const xs = sorted.map((r) => r[x]);
    // periods are evenly spaced: rows at their own times are records, whatever their columns are called
    const gaps = xs.slice(1).map((v, i) => msOf(v) - msOf(xs[i]));
    const step = median(gaps);
    if (gaps.filter((g) => g === step).length < gaps.length * 0.6) return [];
    const span: Span = spanOf(xs);
    const zone = zoneOf(xs);
    const each = span === "days" ? "day" : "period";
    // a period the window cuts through is short by the cut, not by what happened in it
    const win = windowOf(input.sql, input.anchor, input.now);
    const edge = win ? edgesOf(xs, win) : null;
    const full = sorted.filter((_, i) => !(edge?.first && i === 0) && !(edge?.last && i === sorted.length - 1));
    const vals = full.map((r) => num(r[main.column]) ?? 0);
    if (full.length >= 6) {
      const mid = median(vals);
      const hi = Math.max(...vals);
      const at = full[vals.indexOf(hi)];
      if (mid > 0 && hi >= 2 * mid)
        found.push({ kind: "peak", tag: "Peak", key: at[x], row: at, tone: "plain", score: Math.min(hi / mid, 8) / 8, ask: `What drove the peak at ${fmtX(at[x], span === "days" ? "days" : "hours", "UTC")} UTC?`, text: `${tipX(at[x], span, zone)} held ${amount(hi)}, ${times(hi / mid)} the median ${each}.` });
    }
    if (full.length >= 8) {
      const half = full.length >> 1;
      const [a, b] = [vals.slice(0, half), vals.slice(full.length - half)].map((v) => v.reduce((p, q) => p + q, 0) / v.length);
      const d = a > 0 ? (b - a) / a : 0;
      if (Math.abs(d) >= 0.25)
        found.push({ kind: "trend", tag: "Trend", tone: d > 0 ? "up" : "down", score: (Math.min(Math.abs(d), 2) / 2) * 0.7, ask: `What drove the ${d > 0 ? "rise" : "fall"} in the later half?`, text: `The later half averaged ${amount(mean(b))} per ${each}, ${pct(Math.abs(d))} ${d > 0 ? "above" : "below"} the earlier half.` });
    }
    const total = input.totals?.sum[main.column] ?? sumOf(rows, main.column);
    if (prior) {
      const was = prior.totals?.sum[main.column] ?? sumOf(prior.rows, main.column);
      const p = was > 0 ? (total - was) / was : 0;
      if (Math.abs(p) >= 0.1)
        found.push({ kind: "change", tag: "Change", tone: p > 0 ? "up" : "down", score: Math.min(Math.abs(p), 1) * 0.6, ask: `What drove the ${p > 0 ? "rise" : "fall"} against ${before}?`, text: `${period ? "The total" : main.label} ${p > 0 ? "rose" : "fell"} ${changeText(total, was).replace(/^[+-]/, "")} against ${before}: ${say(total)}, from ${say(was)}.` });
    }
    if (fail && total > 0) {
      const bad = input.totals?.sum[fail.column] ?? sumOf(rows, fail.column);
      const rate = bad / total;
      const wasAll = prior ? (prior.totals?.sum[main.column] ?? sumOf(prior.rows, main.column)) : 0;
      const wasRate = prior && wasAll > 0 ? (prior.totals?.sum[fail.column] ?? sumOf(prior.rows, fail.column)) / wasAll : null;
      if (rate >= 0.05 && rate <= 1)
        found.push({
          kind: "failure",
          tag: "Failures",
          tone: "bad",
          score: Math.min(rate * 2, 1) * 0.75,
          ask: `Which contracts ${failed} most?`,
          text: `${pct(rate)} of ${what} ${failed}: ${say(bad, fail)} of ${say(total)}${wasRate !== null && Math.abs(rate - wasRate) >= 0.01 ? `, ${rate > wasRate ? "up" : "down"} from ${pct(wasRate)} in ${before}` : ""}.`,
        });
    }
  } else {
    const name = (r: Row) => xText(names, x, r[x], "other");
    // a row as a question names it: its value in full, which a model can look up, with the name the page shows
    const full = (r: Row) => (name(r) === String(r[x]) ? String(r[x]) : `${name(r)} (${String(r[x])})`);
    const ranked = [...rows].filter((r) => num(r[main.column]) !== null).sort((p, q) => (num(q[main.column]) ?? 0) - (num(p[main.column]) ?? 0));
    if (ranked.length < 3) return [];
    const [top, second] = ranked;
    const shown = sumOf(rows, main.column);
    // the whole a share is of: every row's sum when a LIMIT cut none, else the sum the totals read past it
    const whole = cut ? (input.totals?.sum[main.column] ?? null) : shown;
    const [v1, v2] = [num(top[main.column]) ?? 0, num(second[main.column]) ?? 0];
    if (whole && whole > 0 && v1 / whole >= 0.25) found.push({ kind: "leader", tag: "Leader", key: top[x], row: top, ask: `What is behind ${full(top)}?`, tone: "plain", score: Math.min(v1 / whole, 1) * 0.9, text: `${name(top)} holds ${pct(v1 / whole)} of ${what}: ${say(v1)} of ${say(whole)}.` });
    else if (v2 > 0 && v1 >= 2 * v2) found.push({ kind: "leader", tag: "Leader", key: top[x], row: top, ask: `What is behind ${full(top)}?`, tone: "plain", score: (Math.min(v1 / v2, 6) / 6) * 0.8, text: `${name(top)} leads with ${amount(v1)}, ${times(v1 / v2)} the next (${name(second)}).` });
    if (whole && whole > 0 && ranked.length >= 6) {
      const three = ranked.slice(0, 3).reduce((n, r) => n + (num(r[main.column]) ?? 0), 0);
      if (three / whole >= 0.5 && v1 / whole < 0.5) found.push({ kind: "concentration", tag: "Concentration", tone: "plain", score: (three / whole) * 0.6, text: `The top 3 hold ${pct(three / whole)} of ${what}.` });
    }
    // the figure before: the series' own twin (this week beside last week), else the rows of the period before
    const twin = period ? series.find((m) => m.column !== main.column && BEFORE_NAME.test(m.column) && m.column.replace(BEFORE_NAME, "$2") === main.column.replace(NOW_NAME, "$2")) : undefined;
    const then = twin ? lower(twin.label) : before;
    const earlier = twin ? rows.map((r) => ({ [x]: r[x], [main.column]: r[twin.column] })) : prior?.rows;
    if (earlier) {
      const was = new Map(earlier.map((r) => [String(r[x]), num(r[main.column])]));
      // a mover is a row large enough to matter now or before: a jump from 2 to 9 is noise
      const floor = shown * 0.02;
      const moved = ranked
        .map((r) => ({ r, now: num(r[main.column]) ?? 0, before: was.get(String(r[x])) ?? null }))
        .filter((m): m is { r: Row; now: number; before: number } => m.before !== null && m.before > 0 && Math.max(m.now, m.before) >= floor)
        .map((m) => ({ ...m, p: (m.now - m.before) / m.before }))
        .sort((p, q) => Math.abs(q.p) - Math.abs(p.p))[0];
      if (moved && Math.abs(moved.p) >= 0.3)
        found.push({ kind: "mover", tag: "Mover", key: moved.r[x], row: moved.r, ask: `What drove ${full(moved.r)} ${moved.p > 0 ? "up" : "down"} against ${then}?`, tone: moved.p > 0 ? "up" : "down", score: (Math.min(Math.abs(moved.p), 3) / 3) * 0.85, text: `${name(moved.r)} ${moved.p > 0 ? "rose" : "fell"} ${changeText(moved.now, moved.before).replace(/^[+-]/, "")} against ${then}: ${say(moved.now)}, from ${say(moved.before)}.` });
      // the rows before are a ranking of the same length: a name they lack was below its last place
      const fresh = !twin && prior && prior.rows.length >= ranked.length ? ranked.slice(0, 5).find((r) => !was.has(String(r[x]))) : undefined;
      if (fresh && prior) found.push({ kind: "newcomer", tag: "New", key: fresh[x], row: fresh, ask: `What is ${full(fresh)}, and why is it new here?`, tone: "up", score: 0.65, text: `${name(fresh)} was not among the top ${prior.rows.length} in ${before}. It is number ${ranked.indexOf(fresh) + 1} now, with ${amount(num(fresh[main.column]) ?? 0)}.` });
    }
    if (fail) {
      const mid = median(ranked.map((r) => num(r[main.column]) ?? 0));
      const worst = ranked
        .filter((r) => (num(r[main.column]) ?? 0) >= mid && (num(r[main.column]) ?? 0) > 0)
        .map((r) => ({ r, rate: (num(r[fail.column]) ?? 0) / (num(r[main.column]) ?? 1) }))
        .sort((p, q) => q.rate - p.rate)[0];
      if (worst && worst.rate >= 0.2 && worst.rate <= 1)
        found.push({ kind: "failure", tag: "Failures", key: worst.r[x], row: worst.r, ask: `Why did ${full(worst.r)} ${failed.replace(/ed$/, "")} so often?`, tone: "bad", score: Math.min(worst.rate, 1) * 0.8, text: `${name(worst.r)} ${failed} on ${pct(worst.rate)} of its ${amount(num(worst.r[main.column]) ?? 0)}.` });
    }
  }
  return found.sort((p, q) => q.score - p.score).slice(0, FINDINGS);
}
