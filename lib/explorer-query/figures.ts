/* what a model reads about the rows: the figures over all of them, then a sample */

import type { ModelCall } from "./meter";
import type { ColumnMeta } from "./clickhouse";
import type { ChartSpec, Names, Totals } from "./types";
import { edgesOf, msOf, windowOf } from "./edges";
import { staleLine } from "./scope";
import { exprOf, uniqAliases } from "./aliases";
import { ownTokens } from "./checks";

type Row = Record<string, unknown>;

/** the most rows a model reads in full; past that it reads a sample */
export const ALL_ROWS = 100;

export interface DesignInput {
  question: string;
  title: string;
  note: string;
  symbol: string;
  columns: ColumnMeta[];
  rows: Row[];
  names: Names;
  chart: ChartSpec;
  /** when the rows stop at a LIMIT: the whole result's size and figures */
  totals?: Totals | null;
  /** the column a row is known by, when there is no chart to say it */
  x?: string;
  /** the SQL as written and the time it read as now: which edge buckets its window cuts */
  sql?: string;
  anchor?: string | null;
  /** each model call reports here (meter.ts) */
  spent?: (call: ModelCall) => void;
}

type Seen = Pick<DesignInput, "columns" | "rows" | "names" | "totals" | "x" | "sql" | "anchor">;

export const NUMERIC = /^(Nullable\()?(U?Int\d+|Float\d+|Decimal)/;
const TIME = /^(Nullable\()?Date/;

/* a column that counts distinct things in each row (active addresses, senders, holders) has no total over the rows:
   a sum counts one address once for each row it is in (the L1 audit's L14 summed a week's daily active addresses,
   149 against 85 distinct). A count of new ones, first seen in their row, adds up */
const DISTINCT_NAME = /(?:^|_)(?:addresses|addrs|senders|recipients|receivers|callers|holders|wallets|users|accounts|traders|swappers|depositors|borrowers|signers|participants|(?:uniq|distinct|unique)\w*)(?:_|$)/i;
const NEW_NAME = /(?:^|_)(?:new|first)(?:_|$)/i;
/** the columns that count distinct things in each row, by their name or by the uniq call that makes them */
export function distinctColumns(columns: readonly ColumnMeta[], sql?: string): Set<string> {
  const made = sql ? uniqAliases(sql) : new Set<string>();
  return new Set(columns.filter((c) => NUMERIC.test(c.type) && !NEW_NAME.test(c.name) && (made.has(c.name) || DISTINCT_NAME.test(c.name))).map((c) => c.name));
}

/* an average in each row (avg_gwei, median_fee) has no total, and the mean of the rows' averages is not the average
   over what they count: the follow-up audit's T10 read the mean of 8 hourly means as today's average gas price. A
   count beside it (txs) weighs each row's average, which gives that average. A maximum in each row (max_fee) ranks
   rows, not the items in them: T02 read the second-highest hourly maximum as the second-highest block */
export const MEAN_NAME = /(?:^|_)(?:avg|average|mean|median|p\d{2})(?:_|$)/i;
/* a median or a percentile in each row has no weighted average either: no count beside it weighs the rows' medians
   into the median of what they count (the r6 audit's C05b called the transaction-weighted mean of 8 hourly medians,
   6.54, the day's median, which is 6.50) */
const QUANTILE_NAME = /(?:^|_)(?:median|p\d{2})(?:_|$)/i;
const MAX_NAME = /(?:^|_)(?:max|maximum|peak|highest)(?:_|$)/i;
export const EXTREME_NAME = /(?:^|_)(?:max|maximum|peak|highest|min|minimum|lowest)(?:_|$)/i;
const COUNT_NAME = /(?:^|_)(?:txs|transactions|transfers|count|blocks|calls|swaps)(?:_|$)/i;
/** the period words of a period that runs to now */
const CURRENT_PERIOD = /^(?:current|today|this|this_week|this_month|cur)$/;

/* a period's column beside the same column of the period before: today_txs and yesterday_txs, current_x and
   previous_x, txs_this_week and txs_last_week */
const PERIODS: [string, string[]][] = [
  ["this_week", ["last_week", "previous_week", "prior_week"]],
  ["this_month", ["last_month", "previous_month", "prior_month"]],
  ["current", ["previous", "prior", "last"]],
  ["today", ["yesterday"]],
  ["this", ["last", "previous", "prev"]],
  ["cur", ["prev", "previous"]],
];

/** the period a column's name gives (current, previous, today), and the rest of the name */
function periodOf(name: string): { word: string; rest: string } | null {
  const n = name.toLowerCase();
  for (const w of PERIODS.flatMap(([now, before]) => [now, ...before])) {
    if (n.startsWith(`${w}_`)) return { word: w, rest: n.slice(w.length + 1) };
    if (n.endsWith(`_${w}`)) return { word: w, rest: n.slice(0, -(w.length + 1)) };
  }
  return null;
}

/** each period's number column with the same column of the period before it */
function pairsOf(columns: readonly ColumnMeta[]): [ColumnMeta, ColumnMeta][] {
  const nums = columns.filter((c) => NUMERIC.test(c.type));
  const out: [ColumnMeta, ColumnMeta][] = [];
  for (const c of nums) {
    const p = periodOf(c.name);
    const before = p && PERIODS.find(([now]) => now === p.word)?.[1];
    const match = before && nums.find((k) => k !== c && before.some((b) => { const q = periodOf(k.name); return q?.word === b && q.rest === p.rest; }));
    if (match) out.push([c, match]);
  }
  return out;
}

/** the count that weighs an average's rows: the one count column of the same period (txs beside avg_gwei). None when
    there are several (txs and blocks), since the wrong one gives a wrong average */
export function weightOf(columns: readonly ColumnMeta[], c: ColumnMeta): ColumnMeta | null {
  const word = periodOf(c.name)?.word ?? null;
  const counts = columns.filter((k) => k !== c && NUMERIC.test(k.type) && COUNT_NAME.test(k.name) && !MEAN_NAME.test(k.name) && (periodOf(k.name)?.word ?? null) === word);
  return counts.length === 1 && !QUANTILE_NAME.test(c.name) ? counts[0] : null;
}

/** a value as a model reads it: a name where the server found one */
function shown(input: Pick<DesignInput, "names">, column: string, v: unknown): unknown {
  const name = typeof v === "string" ? input.names[column]?.[v.toLowerCase()] : undefined;
  return name ? `${name} (${String(v).slice(0, 10)}…)` : v;
}

/** a number as a model reads it: plain digits, six significant, never 1.2e+6 */
export const plain = (n: number) => (Number.isInteger(n) ? String(n) : String(Number(n.toPrecision(6))));

/** totals that hold only the whole set's size, a ranking's own count (cut.ts), with no figures read beside it */
const sizeOnly = (t: Totals) => !Object.keys(t.sum).length && !Object.keys(t.distinct).length;

/** a share as a reading quotes it, one decimal by the usual rule: 0.45539 is 45.5%. A share that is
    neither none nor all keeps the digits it needs never to read 0.0% or 100.0%: 0.00043 is 0.043%, so a
    reading never calls a real share zero ("under 0.0%") or the whole */
const pct = (f: number) => {
  const p = f * 100;
  const edge = p > 0 && p < 100 ? Math.min(p, 100 - p) : 100;
  if (edge >= 0.05) return `${(Math.round(f * 1000) / 10).toFixed(1)}%`;
  return `${p.toFixed(1 - Math.floor(Math.log10(edge))).replace(/\.?0+$/, "")}%`;
};
/** a figure whose sum means nothing: a rate, a price, an average, a share already */
export const RATE = /(?:^|_)(?:pct|percent|rate|ratio|share|price|avg|average|median|mean|apr|apy|bps|index|decimals|of_total)(?:_|$)/i;

/** the figures of one column a reading names most, each with its share of the column's total: the highest, the
    next two, and the highest two and three together. None when a share means nothing: a rate, a figure below
    zero, rows the LIMIT cut, the rows' own label */
function topShares(c: ColumnMeta, nums: { v: number }[], label: ColumnMeta | null, cut: boolean): { v: number; share: number }[] {
  const sum = nums.reduce((t, x) => t + x.v, 0);
  if (cut || !(sum > 0) || nums.some((x) => x.v < 0) || RATE.test(c.name) || c.name === label?.name) return [];
  const top = nums.map((x) => x.v).sort((p, q) => q - p).slice(0, 3);
  const sums = top.length === 3 ? [top[0] + top[1], top[0] + top[1] + top[2]] : [];
  return [...top, ...sums].map((v) => ({ v, share: v / sum }));
}

/** every share Figures gives, in percent, for a callout's share to be held against */
export function sharesOf(input: Seen): number[] {
  const label = labelOf(input);
  const cut = !!input.totals && input.totals.rows > input.rows.length;
  return input.columns.flatMap((c) => {
    const nums = input.rows.map((r) => numOf(c, r[c.name])).filter((v): v is number => v !== null).map((v) => ({ v }));
    return nums.length ? topShares(c, nums, label, cut).map((s) => s.share * 100) : [];
  });
}

/** a callout's share of the total that misses one Figures gives by less than its last digit reads that share,
    rounded to the same digits: 45.6% of the total, where the highest two hold 45.54%, reads 45.5% */
export function withShares(callout: string, shares: readonly number[]): string {
  return callout.replace(/(?<![\d.])(\d{1,3})(?:\.(\d{1,2}))?%(?=\s+of\s+(?:the|all)\b)/g, (m, whole: string, dec: string | undefined) => {
    const digits = dec?.length ?? 0;
    const said = Number(dec ? `${whole}.${dec}` : whole);
    const near = shares.filter((s) => Math.abs(s - said) < 10 ** -digits).sort((p, q) => Math.abs(p - said) - Math.abs(q - said))[0];
    return near === undefined ? m : `${(Math.round(near * 10 ** digits) / 10 ** digits).toFixed(digits)}%`;
  });
}

/** the column a row is known by: the chart's x, else a time, else the first text column */
function labelOf(input: Seen): ColumnMeta | null {
  const { columns } = input;
  return columns.find((c) => c.name === input.x) ?? columns.find((c) => TIME.test(c.type)) ?? columns.find((c) => !NUMERIC.test(c.type)) ?? null;
}

/** the way rows run along a column: 1 rising, -1 falling, 0 not in order */
function runOf(rows: { r: Row }[], column: string): 1 | -1 | 0 {
  let dir: 1 | -1 | 0 = 0;
  for (let i = 1; i < rows.length; i++) {
    const [p, q] = [rows[i - 1].r[column], rows[i].r[column]];
    const d = typeof p === "number" && typeof q === "number" ? Math.sign(q - p) : Math.sign(String(q).localeCompare(String(p)));
    if (d === 0) continue;
    if (dir && d !== dir) return 0;
    dir = d as 1 | -1;
  }
  return dir;
}

/* A share a query takes over its whole result (x / sum(x) OVER ()) is of what the rows it keeps count, after its
   filters and before its LIMIT: the regression audit's R06 called 8.06% of the gas of the 2,034 contracts it kept
   "8.06% of all gas charged" (of all gas it is 7.92%). Each such column, with the size of the result when a
   count() OVER () column gives it */
const OVER_ALL = /\bover\s*\(\s*\)/i;
function wholeShares(input: Seen): Map<string, number | null> {
  const out = new Map<string, number | null>();
  if (!input.sql || input.rows.length === 0) return out;
  const exprs = new Map(input.columns.map((c) => [c.name, exprOf(input.sql!, c.name)] as const));
  const size = input.columns.find((c) => /^count\(\s*\)\s*over\s*\(\s*\)$/i.test(exprs.get(c.name) ?? ""));
  const n = size ? numOf(size, input.rows[0][size.name]) : null;
  for (const c of input.columns) {
    const e = exprs.get(c.name);
    if (e && NUMERIC.test(c.type) && OVER_ALL.test(e) && e.includes("/")) out.set(c.name, n);
  }
  return out;
}

/* The figures a reading quotes, computed over every row, since past
   ALL_ROWS a model sees only a sample of them: each number column's total,
   average and extremes with the row that holds each (and the next two
   highest), its first and last values, and along time its largest rise and
   fall between neighbouring rows; each other column's distinct count and
   range. When the rows stop at a LIMIT, the cut comes first and the whole
   result's figures stand beside the rows' own, so a sum over the rows
   shown is never passed off as the total. */
export function figures(input: Seen): string[] {
  const { columns, rows, totals } = input;
  const label = labelOf(input);
  // rows along time or height, where a change between neighbouring rows is a step
  const along = !!label && (TIME.test(label.type) || /^(block_number|block_height|height)$/i.test(label.name));
  const at = (r: Row) => (label ? `${label.name} ${String(shown(input, label.name, r[label.name]))}` : `row ${rows.indexOf(r) + 1}`);
  const cut = !!totals && totals.rows > rows.length;
  const perRow = distinctColumns(columns, input.sql);
  const whole = wholeShares(input);
  const out: string[] = [];
  if (totals && cut) {
    out.push(
      totals.newest
        ? `The rows are the newest ${rows.length} of ${totals.rows}: the row cap cut the oldest.`
        : `The rows are the first ${rows.length} of ${totals.rows}: the query's LIMIT cut the rest. ${sizeOnly(totals) ? `A sum over these rows is not the total over all ${totals.rows}; a count stat shows all ${totals.rows}.` : `A sum over these rows is not the total; the total over all ${totals.rows} is given beside it. A stat's sum, average, count or distinct shows the figure over all ${totals.rows}, so its label names the whole set, never these ${rows.length}.`}`,
    );
  }
  // which edge buckets the window cuts, from the same reading of the SQL as the chart's labels
  if (input.sql && label && TIME.test(label.type)) {
    const edge = edgeOf(input);
    if (edge) out.push(`Edges: the first period, ${at(rows[edge.lo])}, is ${edge.first ? "partial, since the window starts inside it" : "complete"}; the last, ${at(rows[edge.hi])}, is ${edge.last ? (staleOf(input.anchor) ? "cut where the index ends" : "still filling") : "complete"}.`);
  }
  for (const c of columns) {
    // a native amount on the network's rows is in each chain's own token: 9.21 GUN is not more than 3.73 AVAX
    if (rows.length > 1 && ownTokens(c.name, rows)) {
      out.push(`${c.name} (${c.type}): each row is in its own chain's native token (its token column), so no total, highest, lowest or share spans the rows: quote each chain's amount in its own token, and never set two chains' amounts against each other or call one the largest`);
      continue;
    }
    const nums: { r: Row; v: number }[] = [];
    for (const r of rows) {
      const v = numOf(c, r[c.name]);
      if (v !== null) nums.push({ r, v });
    }
    if (nums.length) {
      let hi = nums[0];
      let lo = nums[0];
      let sum = 0;
      for (const x of nums) {
        if (x.v > hi.v) hi = x;
        if (x.v < lo.v) lo = x;
        sum += x.v;
      }
      const all = totals && cut && totals.sum[c.name] !== undefined ? totals : null;
      // a figure the same in every row (a set's size, of_total) is one figure, and its sum means nothing
      if (rows.length > 1 && nums.length === rows.length && hi.v === lo.v && (!all || (all.max[c.name] === hi.v && all.min[c.name] === hi.v))) {
        out.push(`${c.name} (${c.type}): ${plain(hi.v)} in every row`);
        continue;
      }
      // the next highest rows too, for when the highest is a bucket still filling
      const next = nums.filter((t) => t !== hi).sort((p, q) => q.v - p.v).slice(0, 2);
      // how many rows hold a figure, so a reading never counts rows itself (the regression audit's R12 said twelve
      // contracts had one sender, where 13 of the 15 rows did)
      const held = (v: number) => {
        const n = nums.filter((t) => t.v === v).length;
        return n > 1 ? ` (${n} rows hold it${cut ? " among those shown" : ""})` : "";
      };
      // a distinct count in each row has no total over the rows, and no share of one; nor has an average
      const noTotal = rows.length > 1 && perRow.has(c.name);
      const mean = rows.length > 1 && MEAN_NAME.test(c.name);
      const extreme = rows.length > 1 && !mean && EXTREME_NAME.test(c.name);
      const weight = mean ? weightOf(columns, c) : null;
      const weighed = weight ? weighted(c, weight, rows) : null;
      // the shares of the total those rows hold, so a callout quotes a share rather than divides rounded figures
      const shared = !noTotal && !extreme && topShares(c, nums, label, cut).length > 0;
      // a whole-result extreme past the rows shown, named by its own row, so a reading never pins it on a row shown
      const hidden = (v: number, where: string | undefined) => ` (${plain(v)}${where !== undefined && all?.label ? ` at ${all.label} ${where},` : ""} in a row not shown)`;
      const size = whole.get(c.name);
      const parts = [
        ...(whole.has(c.name) ? [`each row's share of the sum over ${size ? `all ${plain(size)}` : "all the"} rows the query keeps (after its filters, before its LIMIT), not of the chain's whole: name that base by what those rows are`] : []),
        noTotal ? "no total: each row counts its own distinct ones, and one in several rows is in each" : mean ? "no total: each row holds an average, and a sum of averages means nothing" : extreme ? "no total: each row holds its own highest or lowest value, and a sum of them means nothing" : all ? `total ${plain(all.sum[c.name])} over all ${all.rows} rows (${plain(sum)} over these ${rows.length})` : `total ${plain(sum)}`,
        mean
          ? `mean of the row values ${plain(sum / nums.length)}, which is not the ${QUANTILE_NAME.test(c.name) ? "median of what the rows count, and no weighting makes one" : "average over what the rows count"}${weighed !== null ? `; weighted by ${weight!.name}, that average is ${plain(weighed)}` : ""}`
          : `avg ${plain(sum / nums.length)}`,
        `max ${plain(hi.v)} at ${at(hi.r)}${held(hi.v)}${all && all.max[c.name] > hi.v ? hidden(all.max[c.name], all.maxAt?.[c.name]) : ""}${next.length ? `, then${MAX_NAME.test(c.name) ? " the next rows' own maxima (each the highest within its row, not the next highest overall)," : ""} ${next.map((t) => `${plain(t.v)} at ${at(t.r)}`).join(" and ")}` : ""}`,
        `min ${plain(lo.v)} at ${at(lo.r)}${held(lo.v)}${all && all.min[c.name] < lo.v ? hidden(all.min[c.name], all.minAt?.[c.name]) : ""}`,
        `first ${plain(nums[0].v)}, last ${plain(nums[nums.length - 1].v)}`,
      ];
      if (shared && next.length === 2) {
        const [two, three] = [hi.v + next[0].v, hi.v + next[0].v + next[1].v];
        parts.push(`share of the total: the highest ${pct(hi.v / sum)}, then ${pct(next[0].v / sum)} and ${pct(next[1].v / sum)}; the highest two together ${plain(two)} (${pct(two / sum)}), the highest three ${plain(three)} (${pct(three / sum)})`);
      }
      const run = along && label && c.name !== label.name ? runOf(nums, label.name) : 0;
      if (run && nums.length > 2) {
        const seq = run > 0 ? nums : [...nums].reverse();
        let rise: { d: number; i: number } | null = null;
        let fall: { d: number; i: number } | null = null;
        for (let i = 1; i < seq.length; i++) {
          const d = seq[i].v - seq[i - 1].v;
          if (d > 0 && (!rise || d > rise.d)) rise = { d, i };
          if (d < 0 && (!fall || d < fall.d)) fall = { d, i };
        }
        const step = (s: { d: number; i: number }) => `${s.d > 0 ? "+" : ""}${plain(s.d)} from ${at(seq[s.i - 1].r)} to ${at(seq[s.i].r)}`;
        if (rise) parts.push(`largest rise between neighbouring rows ${step(rise)}`);
        if (fall) parts.push(`largest fall between neighbouring rows ${step(fall)}`);
      }
      out.push(`${c.name} (${c.type}): ${parts.join(", ")}`);
      continue;
    }
    const vals = rows.map((r) => r[c.name]);
    const distinct = new Set(vals.map(String)).size;
    const count = totals && cut && totals.distinct[c.name] !== undefined ? `${totals.distinct[c.name]} distinct over all ${totals.rows} rows (${distinct} here)` : `${distinct} distinct`;
    const times = TIME.test(c.type) ? vals.map(String).sort() : null;
    const range = times?.length ? `, from ${times[0]} to ${times[times.length - 1]}` : `, e.g. ${String(shown(input, c.name, vals[0])).slice(0, 60)}`;
    out.push(`${c.name} (${c.type}): ${count}${range}`);
  }
  // a period beside the one before it, over the rows the current one has reached, so a reading compares like with
  // like: the follow-up audit's T15 summed yesterday's first 8 hours as 112.7k, where they hold 105,744. A current
  // period runs to now, so the last row it has reached is still filling and is left out: the regression audit's R01
  // set today's 34 minutes of hour 8 against yesterday's whole hour (+17.1%, where the same time reads +21.5%)
  const running = !!input.sql && /\b(?:now|today)\(\s*\)/i.test(input.sql);
  const filling = staleOf(input.anchor) ? "cut where the index ends" : "still filling";
  if (label && rows.length > 2 && runOf(rows.map((r) => ({ r })), label.name) === 1) {
    for (const [now, before] of pairsOf(columns)) {
      const last = rows.map((r) => numOf(now, r[now.name])).findLastIndex((v) => v !== null && v !== 0);
      if (last < 0) continue;
      const partial = running && CURRENT_PERIOD.test(periodOf(now.name)?.word ?? "");
      const end = partial ? last - 1 : last;
      if (!partial && (last < 1 || last === rows.length - 1)) continue;
      if (end < 0) {
        out.push(`Matched rows: ${now.name} has a value only at ${at(rows[last])}, which is ${filling}: never set it against ${before.name}'s whole period.`);
        continue;
      }
      const span = rows.slice(0, end + 1);
      const each = perRow.has(now.name) || MEAN_NAME.test(now.name);
      const of = (c: ColumnMeta) => {
        const v = span.map((r) => numOf(c, r[c.name])).filter((x): x is number => x !== null);
        const w = each && MEAN_NAME.test(c.name) ? weightOf(columns, c) : null;
        const by = w ? weighted(c, w, span) : null;
        return v.length ? (by ?? (each ? v.reduce((a, b) => a + b, 0) / v.length : v.reduce((a, b) => a + b, 0))) : null;
      };
      const [x, y] = [of(now), of(before)];
      if (x === null || y === null) continue;
      const what = each ? (MEAN_NAME.test(now.name) && weightOf(columns, now) ? "average weighted by the counts beside them" : "mean of the row values") : "total";
      const change = y ? `: ${now.name} is ${x >= y ? "+" : "-"}${pct(Math.abs(x - y) / Math.abs(y))} against ${before.name}` : "";
      const left = partial ? ` ${at(rows[last])} is ${filling}, so it is left out: never set its part against ${before.name}'s whole period.` : "";
      out.push(`Matched rows: ${now.name} has values up to ${at(rows[last])}, so it compares with ${before.name} over the ${span.length} ${partial ? "complete rows before it" : "rows up to there"}, ${what} ${plain(x)} against ${plain(y)}${change}.${left} Compare the two periods over these rows, never one period's part with the other's whole.`);
    }
  }
  return out;
}

/** an average over what the rows count: each row's average weighed by its count */
export function weighted(c: ColumnMeta, w: ColumnMeta, rows: readonly Row[]): number | null {
  let [top, bottom] = [0, 0];
  for (const r of rows) {
    const [v, n] = [numOf(c, r[c.name]), numOf(w, r[w.name])];
    if (v === null || n === null || n <= 0) continue;
    top += v * n;
    bottom += n;
  }
  return bottom > 0 ? top / bottom : null;
}

/** the rows a sample holds, past ALL_ROWS */
const SAMPLE = 24;

/** a cell as a number, when its column holds numbers */
export function numOf(c: ColumnMeta, v: unknown): number | null {
  const n = typeof v === "number" ? v : typeof v === "string" && NUMERIC.test(c.type) && v.trim() !== "" ? Number(v) : NaN;
  return Number.isFinite(n) ? n : null;
}

/** the rows a model sees: all of a short answer; else the first and last five, each number column's
    highest and lowest row, the rows either side of the highest (a reading says what came before and after a peak:
    the follow-up audit's T02 named the hour after one from a row it never saw), and an even spread between them,
    in the rows' own order */
export function sampleOf(input: Seen): { head: string; rows: Row[] } {
  const { rows, columns } = input;
  const named = (r: Row) => Object.fromEntries(columns.map((c) => [c.name, shown(input, c.name, r[c.name])]));
  if (rows.length <= ALL_ROWS) return { head: `All ${rows.length} rows:`, rows: rows.map(named) };
  const pick = new Set<number>();
  for (let i = 0; i < 5; i++) pick.add(i).add(rows.length - 1 - i);
  for (const c of columns) {
    let hi = -1;
    let lo = -1;
    let hv = -Infinity;
    let lv = Infinity;
    rows.forEach((r, i) => {
      const v = numOf(c, r[c.name]);
      if (v === null) return;
      if (v > hv) [hi, hv] = [i, v];
      if (v < lv) [lo, lv] = [i, v];
    });
    if (hi >= 0) pick.add(hi).add(lo);
    for (const i of [hi - 1, hi + 1]) if (hi >= 0 && i >= 0 && i < rows.length) pick.add(i);
  }
  for (let k = 1; pick.size < SAMPLE && k < SAMPLE; k++) pick.add(Math.round((k * (rows.length - 1)) / SAMPLE));
  const at = [...pick].sort((x, y) => x - y);
  return { head: `${at.length} of the ${rows.length} rows, in order: the first and last five, each column's highest and lowest, the rows either side of each highest, and an even spread between:`, rows: at.map((i) => named(rows[i])) };
}

/** where a stale index ends, for a model that reads its rows: the question's today is not the rows' (empty for an
    index that is current) */
const staleOf = (anchor?: string | null) => (anchor ? staleLine(msOf(anchor), Date.now()) : "");
export const staleBrief = (anchor?: string | null) => {
  const line = staleOf(anchor);
  return line ? [`${line} Name each day by its date, never as today, this week or so far.`] : [];
};

/** the edge periods a series' window cuts through: the first when it begins inside it, the last while it is still
    filling (or cut where a stale index ends); null for rows that are not a series along time */
export function edgeOf(input: Seen): ReturnType<typeof edgesOf> {
  const label = labelOf(input);
  if (!input.sql || !label || !TIME.test(label.type)) return null;
  const win = windowOf(input.sql, input.anchor);
  return win && edgesOf(input.rows.map((r) => r[label.name]), win);
}

/** what a model reads about the rows: the figures over all of them, then a sample */
export function rowsBrief(input: Seen): string[] {
  const s = sampleOf(input);
  const t = input.totals;
  const cut = !!t && t.rows > input.rows.length;
  const beside = t && sizeOnly(t) ? ` of ${t.rows}:` : ", with the whole result's beside them:";
  const head = cut ? `Figures, computed over the ${input.rows.length} rows shown${beside}` : `Figures, computed over all ${input.rows.length} rows:`;
  return [head, ...figures(input).map((f) => `- ${f}`), s.head, ...s.rows.map((r) => JSON.stringify(r))];
}
