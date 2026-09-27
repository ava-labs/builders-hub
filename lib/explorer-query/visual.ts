/* The designer. Once the query has run, a second model looks at the
   question and the actual rows and decides how they should be shown:
   which panels, which chart in each, what the headline figures are,
   where a reference line belongs, and what a reader should notice.
   It speaks a small visual grammar the page knows how to draw. */

import { createAnthropic } from "@ai-sdk/anthropic";
import { generateText, stepCountIs, tool } from "ai";
import { z } from "zod";
import type { ColumnMeta } from "./clickhouse";
import type { ChartSpec, Names, Totals } from "./types";
import { edgesOf, windowOf } from "./edges";

const anthropic = createAnthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
export const DESIGN_MODEL = "claude-opus-5-5";
/** the designer runs at low effort: in 20 blind pairs its charts were rated as good as the default's (7 wins each, 6 ties), in about half the time */
export const DESIGN_OPTIONS = { anthropic: { effort: "low" as const } };

/** the most characters a callout shows; it names addresses and hashes in full, and the page draws each short */
const CALLOUT_SHOWN = 160;
/** a callout's cap as written: the shown cap and room for six full hashes, so naming transactions never fails a schema */
const CALLOUT_RAW = CALLOUT_SHOWN + 6 * 55;

export const formatSchema = z.enum(["number", "compact", "percent", "avax", "gas", "seconds", "usd"]);
export type Format = z.infer<typeof formatSchema>;

export const seriesSchema = z.object({
  column: z.string(),
  label: z.string().max(32),
  format: formatSchema.default("number"),
  /** a second axis for a series in different units */
  axis: z.enum(["left", "right"]).default("left"),
  /** how this series is drawn; auto follows the panel kind. Mixing marks
   *  in one panel is how a count (bars) and a rate (line) share a chart */
  mark: z.enum(["auto", "bar", "line", "area"]).default("auto"),
  /** computed on the page from the column: running total, rebased so the
   *  first point is 100 (compares things of different size), the series'
   *  share of the panel's share series per row, or a 5-point average */
  transform: z.enum(["none", "cumulative", "indexed", "share", "rolling"]).default("none"),
  /** a baseline or a previous period, drawn dashed */
  dashed: z.boolean().default(false),
  /** an outflow, drawn below zero: the panel stacks by sign, each period's ins above the axis and its outs below */
  below: z.boolean().optional(),
});
export type Series = z.infer<typeof seriesSchema>;

export const panelSchema = z.object({
  title: z.string().max(60),
  /** hbar: a horizontal ranking; bar: buckets; line and area: continuous;
   *  scatter: one numeric column against another; flow: where value went,
   *  from x to target; table: the rows */
  kind: z.enum(["hbar", "bar", "line", "area", "scatter", "flow", "table"]),
  /** the category or time column; for scatter, the numeric x column; for flow, the column value comes from */
  x: z.string().optional(),
  /** for flow: the column value goes to */
  target: z.string().optional(),
  series: z.array(seriesSchema).max(6).default([]),
  /** vertical marks at x values: a peak, an upgrade, the start of a burst */
  markers: z.array(z.object({ x: z.union([z.string(), z.number()]), label: z.string().max(28) })).max(4).default([]),
  /** shaded x ranges: the window being compared, an incident */
  bands: z.array(z.object({ from: z.union([z.string(), z.number()]), to: z.union([z.string(), z.number()]), label: z.string().max(28) })).max(2).default([]),
  stacked: z.boolean().default(false),
  /** with a series drawn below zero: a line over the bars of each row's net, what came in less what went out */
  net: z.boolean().optional(),
  /** for rankings: order rows by this series column before drawing */
  sortBy: z.string().optional(),
  sortDir: z.enum(["asc", "desc"]).default("desc"),
  /** for rankings: draw only the first N rows after sorting */
  topN: z.number().int().min(1).max(40).optional(),
  /** horizontal guide lines: a limit, an average, a threshold */
  referenceLines: z.array(z.object({ y: z.number(), label: z.string().max(32) })).max(2).default([]),
  width: z.enum(["full", "half"]).default("full"),
});
export type Panel = z.infer<typeof panelSchema>;

export const statSchema = z.object({
  label: z.string().max(28),
  column: z.string(),
  agg: z.enum(["sum", "avg", "max", "min", "first", "last", "count", "distinct"]),
  format: formatSchema.default("number"),
  /** one short line under the figure: what it is or how it compares */
  sub: z.string().max(48).optional(),
});
export type Stat = z.infer<typeof statSchema>;

export const visualSpecSchema = z.object({
  /** two to four headline figures across the top */
  stats: z.array(statSchema).max(4).default([]),
  panels: z.array(panelSchema).min(1).max(4),
  /** one to three sentences a reader should take away, grounded in the rows; the design tool holds each to CALLOUT_SHOWN as the page shows it */
  callouts: z.array(z.string().max(CALLOUT_RAW)).max(3).default([]),
});
export type VisualSpec = z.infer<typeof visualSpecSchema>;

type Row = Record<string, unknown>;

/** the old one-chart spec, as a visual, for when the designer is unavailable */
export function basicVisual(chart: ChartSpec, columns: ColumnMeta[]): VisualSpec {
  if (chart.kind === "none" || chart.kind === "table" || !chart.x || chart.series.length === 0) {
    return { stats: [], panels: [{ title: "Rows", kind: "table", series: [], markers: [], bands: [], stacked: false, sortDir: "desc", referenceLines: [], width: "full" }], callouts: [] };
  }
  const time = columns.find((c) => c.name === chart.x)?.type.startsWith("Date");
  return {
    stats: [],
    panels: [
      {
        title: "",
        kind: chart.kind === "bar" && !time ? "hbar" : chart.kind,
        x: chart.x,
        series: chart.series.map((s) => ({ column: s.column, label: s.label, format: /%/.test(s.unit ?? "") ? "percent" : /avax/i.test(s.unit ?? "") ? "avax" : /gas/i.test(s.unit ?? "") ? "gas" : "number", axis: "left", mark: "auto", transform: "none", dashed: false })),
        markers: [],
        bands: [],
        stacked: !!chart.stacked,
        sortDir: "desc",
        referenceLines: [],
        width: "full",
      },
    ],
    callouts: [],
  };
}


/** the most rows a model reads in full; past that it reads a sample */
const ALL_ROWS = 100;

/* how a reading speaks, for the designer's callouts and the reader's sentences alike: in the reader's
   words, in the right units, with the right verbs */
const READER_RULES =
  "Write for a reader, not the database: no column names and no SQL words (rows displayed, first rows, sample, LIMIT, topic0, to_address), no 'hourly snapshot', and L1, never subnet. Units: an L1 validator's weight is a weight, never AVAX; gas_used summed over transactions is gas charged, not gas reserved; a total per day is not the size of one delegation. Verbs: an address pays or uses gas, it does not charge it; a validator sets a delegation fee. Figures says under Edges whether the first and last periods are complete: never call a partial or filling one a dip or a jump, and when one holds the highest value, name the highest complete period too; a period Edges calls complete is complete. With no Edges line, the first and last periods can be partial: never call them a dip or a jump. Call a span of time a period, an hour or a day, never a bucket. A whole-result figure that Figures puts in a row not shown belongs to that row: never pin it on a row shown. Say every, only, never, all or none about the rows only when all the rows are shown or Figures says it, and take largest, highest and lowest from Figures. A step is the change between neighbouring rows: quote the largest rise or fall from Figures, and call a change across several rows a change over that span, never a step. A share names its base, the thing the rows count: 7.8% of method calls, never of all transactions unless the rows count every transaction. Chain transfers (A to B, then B to C) only when the amounts match and the times follow in order; else name each transfer on its own. The note carries the caveats: a callout adds none, and never words the note's caveat another way. Counts are not amounts: say how much AVAX or value moved only from a column that holds amounts, never from a count of transactions. Write each address and hash in a callout in full, as the rows give it, and never shorten one: the page shortens it.";

/* The reader never sees the SQL, so no reader text names its parts: a
   snake_case name (seen_7d, to_address, p_validator_versions), one of the
   query's own names that holds a digit (topic0), or a comparison it makes
   (balance > 0, version = 'Unknown'). Nor does it say settled: a transaction
   on Avalanche is final. A bucket is never flagged: it reads as a period
   wherever reader text is written. */
const SNAKE = /\b[A-Za-z][A-Za-z0-9]*(?:_[A-Za-z0-9]+)+\b/g;
const DIGITED = /\b[A-Za-z]+\d[A-Za-z0-9]*\b/g;
const COMPARISON = String.raw`[a-z_][a-z0-9_]*\s*(?:[<>]=?|!=|<>|=)\s*(?:-?\d+(?:\.\d+)?|'[^']*'|[a-z_][a-z0-9_]*)`;
const COMPARE = new RegExp(String.raw`\b${COMPARISON}`, "g");
const IN_PARENS = new RegExp(String.raw`\s*\(\s*${COMPARISON}\s*\)`, "g");
/** the word the page never says of a transaction */
const SETTLED = /\bsettl(?:e|es|ed|ing)\b/gi;
/** reader text with each bucket read as a period, the page's word for a span of time */
export const plainWords = (s: string) => s.replace(/\b([Bb])ucket(s?)\b/g, (_, b: string, n: string) => `${b === "B" ? "P" : "p"}eriod${n}`);

/** a query's own names that hold a digit (topic0), outside its quoted strings and comments */
export function sqlNames(sql: string): string[] {
  const code = sql.replace(/'(?:[^'\\]|\\.)*'/g, "''").replace(/--[^\n]*/g, "").replace(/\/\*[\s\S]*?\*\//g, "");
  return [...new Set(code.match(DIGITED) ?? [])];
}

/** the words a reader text must not hold: the SQL's snake_case names, its own names and comparisons, and settled */
export function codeWords(text: string, names: readonly string[] = []): string[] {
  const own = new Set(names);
  return [...new Set([...(text.match(SNAKE) ?? []), ...(text.match(DIGITED) ?? []).filter((w) => own.has(w)), ...(text.match(COMPARE) ?? []), ...(text.match(SETTLED) ?? [])])];
}

/** reader text in the page's words: a bucket reads as a period, and a sentence with a word the page never shows is left out */
export function withoutCode(text: string, names: readonly string[] = []): string {
  const worded = plainWords(text);
  if (codeWords(worded, names).length === 0) return worded;
  // a comparison in parentheses goes on its own, and the sentence around it stays
  return worded
    .replace(IN_PARENS, "")
    .split(/(?<=[.!?])\s+/)
    .filter((s) => codeWords(s, names).length === 0)
    .join(" ");
}

/** a label in the reader's words: seen_7d becomes seen 7d, settled becomes final, and a bucket a period */
export const plainLabel = (s: string) => plainWords(s.replace(SNAKE, (w) => w.replace(/_/g, " ")).replace(/\b([Ss])ettled\b/g, (_, c: string) => (c === "S" ? "Final" : "final")));

/* An address in a reading is one the rows hold, written in full: the page
   shortens it. One a model shortened is written out again from the rows,
   and a callout that names an address the rows do not hold is left out. */
const FULL_HEX = /\b0x(?:[0-9a-fA-F]{64}|[0-9a-fA-F]{40})\b/g;
const SHORT_HEX = /\b0x([0-9a-fA-F]{2,10})(?:…|\.{2,3})([0-9a-fA-F]{2,10})\b/g;

/** the addresses and hashes a reading may name: the rows' own, and those of the rows the whole-result figures point to */
function heldHex(input: Pick<DesignInput, "rows" | "totals">): string[] {
  const held = new Set<string>();
  const add = (v: unknown) => {
    if (typeof v === "string" && /^0x(?:[0-9a-fA-F]{64}|[0-9a-fA-F]{40})$/.test(v)) held.add(v.toLowerCase());
  };
  for (const r of input.rows) Object.values(r).forEach(add);
  [...Object.values(input.totals?.maxAt ?? {}), ...Object.values(input.totals?.minAt ?? {})].forEach(add);
  return [...held];
}

/** a callout with each address in full, from the rows; null when it names one the rows do not hold */
export function withFullHex(c: string, held: readonly string[]): string | null {
  let lost = false;
  const out = c.replace(SHORT_HEX, (m, head: string, tail: string) => {
    const hit = held.filter((a) => a.startsWith(`0x${head.toLowerCase()}`) && a.endsWith(tail.toLowerCase()));
    if (hit.length === 0) lost = true;
    return hit.length === 1 ? hit[0] : m;
  });
  return lost || (out.match(FULL_HEX) ?? []).some((a) => !held.includes(a.toLowerCase())) ? null : out;
}

/** a callout's length as the page draws it: each full address and hash at its short form, 0x1234…abcd */
export const shownLength = (c: string) => c.replace(FULL_HEX, "0x0000…0000").length;

/** every label a visual shows the reader */
function labelsOf(v: VisualSpec): string[] {
  return [
    ...v.stats.flatMap((s) => [s.label, s.sub ?? ""]),
    ...v.panels.flatMap((p) => [p.title, ...p.series.map((s) => s.label), ...p.markers.map((m) => m.label), ...p.bands.map((b) => b.label), ...p.referenceLines.map((r) => r.label)]),
  ];
}

/** a visual in the reader's words: a snake_case name left in a label reads as words, and a callout that names a column,
    or an address the rows do not hold, is left out */
export function readerSpec(v: VisualSpec, names: readonly string[], held?: readonly string[]): VisualSpec {
  const worded = <T extends { label: string }>(o: T): T => ({ ...o, label: plainLabel(o.label) });
  return {
    ...v,
    stats: v.stats.map((s) => ({ ...worded(s), ...(s.sub ? { sub: plainLabel(s.sub) } : {}) })),
    panels: v.panels.map((p) => ({ ...p, title: plainLabel(p.title), series: p.series.map(worded), markers: p.markers.map(worded), bands: p.bands.map(worded), referenceLines: p.referenceLines.map(worded) })),
    callouts: v.callouts.map(plainWords).filter((c) => codeWords(c, names).length === 0).map((c) => (held ? withFullHex(c, held) : c)).filter((c): c is string => c !== null),
  };
}

const HOUSE_STYLE = `You design the visual for an answer on the Avalanche explorer (build.avax.network). The page is a drafting sheet: mono labels, one red accent (#E6212F) then blue, teal, amber; thin lines; no decoration. Your job is to decide what a careful analyst would put on the sheet so the reader sees the answer in two seconds and can check it in ten.

Rules of the sheet
- Rankings (methods, contracts, senders) are horizontal bars (hbar) with the name on the axis, top 10 to 15, sorted by the figure that answers the question. A share or a reverted count that belongs to the same rows goes in a second half-width panel, not as a second series squeezed onto the same axis.
- Time series are lines; counts per period are bars; parts of a whole over time are stacked areas or stacked bars. Never put a count and a percent on the same axis; use axis "right" or a second panel.
- Gas reserved against a limit: a line with the limit as a reference line. Fees in AVAX use format avax. Gas figures use format gas (compact with the word gas). Percent columns use percent.
- Two to four headline stats across the top, the figures a developer would quote: the total, the leader's share, the failure rate when reverts matter, how many distinct callers. Labels are the plain noun a person says ("Transactions", "Reverted", "Callers", "Fees burned"), never "Top 15 txs". Use agg over a column of the rows (sum for counts and fees, max for peaks, avg for rates, distinct for how many groups). The sub line gives the context in five words or fewer, with a name or figure where it helps ("sweep leads", "of all calls").
- Callouts: at most three sentences a developer would act on, each with a name and a figure from the rows: concentration (one sender behind a method), failure (a method that always reverts), cost (who pays the most gas). No adjectives, no restating the chart title. Do not mention the data window or coverage; the page shows it. No em dashes. Never say "settled" or "waiting". Each callout is one full sentence that ends with a period. Write figures as people read them: 3.16M, 64.7k, 41.6%, Aug 30; never 3159411 or 1.395e+6.
- Figures are computed over all rows, and past ${ALL_ROWS} rows the rows shown are a sample: take every peak, low, total, first and last value, and the row that holds it, from Figures, and put a peak's marker at the x Figures names. When Figures says the rows are cut, never call a sum over them the total.
- ${READER_RULES}
- Panel titles: two to four plain words, no "by" chains longer than one.
Comparisons and overlays (use them whenever the rows hold more than one thing to compare)
- Two groups or two periods in columns (usdc_*, usdt_*; current_*, previous_*): overlay them in ONE panel. The baseline or previous period is dashed.
- Things of very different size (a token with 1,000x the volume of another): transform "indexed" rebases each to 100 at its first point, so shape is compared, not size. Say so in the panel title ("indexed to 100").
- Parts of a whole over time: transform "share" on each part plus stacked area, so each period sums to 100%.
- Running totals: transform "cumulative". Noisy per-minute series: add a "rolling" copy of the same column as a thin line over the raw bars.
- A count and a rate together: bars (mark "bar") on the left axis, the rate as a line (mark "line") on the right axis.
- Ins and outs per period (deposits and withdrawals, bought and sold, bridged in and out): one bar series for each side, the outflow with below true, so each period's ins stand above zero and its outs below; set net true on the panel for a line of each period's net. Never draw ins and outs as two lines or as bars side by side.
- Two numeric measures per group or per record (gas against fee, calls against callers): kind "scatter", x the first measure, one series the second.
- Flows: when the question asks where value went, from whom or to whom, and each row is a pair (a column value comes from, a column it goes to, names or addresses, and the amount between them), use kind "flow" at full width: x is the column value comes from, target the column it goes to, and the one series the amount. The page draws the largest 30 flows and folds the rest into Other; a receiver that sends on becomes a second stage. A name stands in one row per partner, so never put an hbar or a pie over such rows: it would show one sender many times. Rows with one name each (who received the most) stay an hbar.
- Markers: put one on the peak and on anything a callout names. Bands: shade the window the question compares.
- A strong answer usually has one overlay panel that makes the comparison and one supporting panel that explains it.

- Only reference columns that exist. Panel titles are four words or fewer. Half-width panels come in pairs.`;

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
}

type Seen = Pick<DesignInput, "columns" | "rows" | "names" | "totals" | "x" | "sql" | "anchor">;

const NUMERIC = /^(Nullable\()?(U?Int\d+|Float\d+|Decimal)/;
const TIME = /^(Nullable\()?Date/;

/** a value as a model reads it: a name where the server found one */
function shown(input: Pick<DesignInput, "names">, column: string, v: unknown): unknown {
  const name = typeof v === "string" ? input.names[column]?.[v.toLowerCase()] : undefined;
  return name ? `${name} (${String(v).slice(0, 10)}…)` : v;
}

/** a number as a model reads it: plain digits, six significant, never 1.2e+6 */
const plain = (n: number) => (Number.isInteger(n) ? String(n) : String(Number(n.toPrecision(6))));

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
  const out: string[] = [];
  if (totals && cut) {
    out.push(
      totals.newest
        ? `The rows are the newest ${rows.length} of ${totals.rows}: the row cap cut the oldest.`
        : `The rows are the first ${rows.length} of ${totals.rows}: the query's LIMIT cut the rest. A sum over these rows is not the total; the total over all ${totals.rows} is given beside it.`,
    );
  }
  // which edge buckets the window cuts, from the same reading of the SQL as the chart's labels
  if (input.sql && label && TIME.test(label.type)) {
    const win = windowOf(input.sql, input.anchor);
    const edge = win && edgesOf(rows.map((r) => r[label.name]), win);
    if (edge) out.push(`Edges: the first period, ${at(rows[edge.lo])}, is ${edge.first ? "partial, since the window starts inside it" : "complete"}; the last, ${at(rows[edge.hi])}, is ${edge.last ? "still filling" : "complete"}.`);
  }
  for (const c of columns) {
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
      // a whole-result extreme past the rows shown, named by its own row, so a reading never pins it on a row shown
      const hidden = (v: number, where: string | undefined) => ` (${plain(v)}${where !== undefined && all?.label ? ` at ${all.label} ${where},` : ""} in a row not shown)`;
      const parts = [
        all ? `total ${plain(all.sum[c.name])} over all ${all.rows} rows (${plain(sum)} over these ${rows.length})` : `total ${plain(sum)}`,
        `avg ${plain(sum / nums.length)}`,
        `max ${plain(hi.v)} at ${at(hi.r)}${all && all.max[c.name] > hi.v ? hidden(all.max[c.name], all.maxAt?.[c.name]) : ""}${next.length ? `, then ${next.map((t) => `${plain(t.v)} at ${at(t.r)}`).join(" and ")}` : ""}`,
        `min ${plain(lo.v)} at ${at(lo.r)}${all && all.min[c.name] < lo.v ? hidden(all.min[c.name], all.minAt?.[c.name]) : ""}`,
        `first ${plain(nums[0].v)}, last ${plain(nums[nums.length - 1].v)}`,
      ];
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
  return out;
}

/** the rows a sample holds, past ALL_ROWS */
const SAMPLE = 24;

/** a cell as a number, when its column holds numbers */
function numOf(c: ColumnMeta, v: unknown): number | null {
  const n = typeof v === "number" ? v : typeof v === "string" && NUMERIC.test(c.type) && v.trim() !== "" ? Number(v) : NaN;
  return Number.isFinite(n) ? n : null;
}

/** the rows a model sees: all of a short answer; else the first and last five, each number column's
    highest and lowest row, and an even spread between them, in the rows' own order */
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
  }
  for (let k = 1; pick.size < SAMPLE && k < SAMPLE; k++) pick.add(Math.round((k * (rows.length - 1)) / SAMPLE));
  const at = [...pick].sort((x, y) => x - y);
  return { head: `${at.length} of the ${rows.length} rows, in order: the first and last five, each column's highest and lowest, and an even spread between:`, rows: at.map((i) => named(rows[i])) };
}

/** what a model reads about the rows: the figures over all of them, then a sample */
function rowsBrief(input: Seen): string[] {
  const s = sampleOf(input);
  const cut = !!input.totals && input.totals.rows > input.rows.length;
  const head = cut ? `Figures, computed over the ${input.rows.length} rows shown, with the whole result's beside them:` : `Figures, computed over all ${input.rows.length} rows:`;
  return [head, ...figures(input).map((f) => `- ${f}`), s.head, ...s.rows.map((r) => JSON.stringify(r))];
}

const READER_MODEL = "claude-haiku-4-5-20251001";

/** fresh callouts for a kept layout: the layout outlives its rows, the
    sentences do not, so a fast model writes them again from these rows */
export async function writeReading(input: Omit<DesignInput, "chart">, again = true): Promise<string[]> {
  if (input.rows.length === 0) return [];
  let out: string[] = [];
  const reading = tool({
    description: "One to three callouts on these rows.",
    inputSchema: z.object({ callouts: z.array(z.string().max(CALLOUT_RAW)).max(3) }),
    execute: async ({ callouts }) => {
      // a callout that names a column or an address the rows do not hold, or that runs past CALLOUT_SHOWN as shown, is left out
      const names = input.columns.map((c) => c.name);
      const held = heldHex(input);
      out = callouts.map((c) => c.replace(/\u2014/g, ",")).map(plainWords).filter((c) => codeWords(c, names).length === 0).map((c) => withFullHex(c, held)).filter((c): c is string => c !== null).filter((c) => shownLength(c) <= CALLOUT_SHOWN).slice(0, 3);
      return { ok: true };
    },
  });
  try {
    await generateText({
      model: anthropic(READER_MODEL),
      system: [
        "You write the short reading under a chart on the Avalanche explorer.",
        "At most three sentences a developer would act on, each with a name and a figure from the rows: concentration (one sender behind a method), failure (a method that always reverts), cost (who pays the most gas).",
        "No adjectives, no restating the title. Do not mention the data window. No em dashes. Never say settled or waiting.",
        "Each callout is one full sentence that ends with a period. Write figures as people read them: 3.16M, 64.7k, 41.6%, Aug 30; never 3159411 or 1.395e+6.",
        `Figures are computed over all rows; past ${ALL_ROWS} rows the rows shown are a sample. Take every peak, low, total, first and last value, and the row that holds it, from Figures, never from the rows shown.`,
        "When Figures says the rows are cut, say they are the first (or the newest) of the total, and never call a sum over them the total.",
        READER_RULES,
        "Call the reading tool once.",
      ].join("\n"),
      messages: [
        {
          role: "user",
          content: [
            `Question: ${input.question}`,
            `Title: ${input.title}`,
            `Native token: ${input.symbol}. Rows: ${input.rows.length}${input.totals && input.totals.rows > input.rows.length ? ` of ${input.totals.rows}` : ""}.`,
            ...rowsBrief(input),
          ].join("\n"),
        },
      ],
      tools: { reading },
      toolChoice: { type: "tool", toolName: "reading" },
      stopWhen: [stepCountIs(1)],
      maxRetries: 1,
    });
  } catch (e) {
    console.warn("[explorer-query] reading failed:", e instanceof Error ? e.message : e);
  }
  // an empty reading is written once more: a kept chart with no sentence under it reads as broken
  if (out.length === 0 && again) return writeReading(input, false);
  return out;
}

export async function designVisual(input: DesignInput): Promise<{ visual: VisualSpec; ms: number; fromDesigner: boolean; error?: string; steps: number; refused: string[] }> {
  const t0 = Date.now();
  const fallback = basicVisual(input.chart, input.columns);
  if (input.rows.length === 0) return { visual: fallback, ms: 0, fromDesigner: false, steps: 0, refused: [] };
  let error: string | undefined;

  const seen = { ...input, x: input.x ?? input.chart.x };
  const sample = sampleOf(seen).rows;
  const cols = new Set(input.columns.map((c) => c.name));

  let visual: VisualSpec | null = null;
  let relabeled = false;
  // what a slow layout's timing shows: the model's steps, and each visual turned back by the design tool's checks or its schema
  let steps = 0;
  const refused: string[] = [];
  const tally = ({ steps: taken = [] }: { steps?: { content: { type: string; error?: unknown }[] }[] }) => {
    steps += taken.length;
    for (const c of taken.flatMap((s) => s.content)) if (c.type === "tool-error") refused.push(String(c.error instanceof Error ? c.error.message : c.error).slice(0, 200));
  };
  const check = (spec: VisualSpec): { error: string } | { ok: true } => {
    const bad = [
      ...spec.stats.filter((s) => !cols.has(s.column)).map((s) => `stat ${s.label} -> ${s.column}`),
      ...spec.panels.flatMap((p) => [...(p.x && !cols.has(p.x) ? [`panel x ${p.x}`] : []), ...(p.target && !cols.has(p.target) ? [`panel target ${p.target}`] : []), ...p.series.filter((s) => !cols.has(s.column)).map((s) => `series ${s.column}`), ...(p.sortBy && !cols.has(p.sortBy) ? [`sortBy ${p.sortBy}`] : [])]),
    ];
    if (bad.length) return { error: `these columns are not in the rows: ${bad.join("; ")}. Columns: ${[...cols].join(", ")}` };
    if (spec.panels.some((p) => p.kind !== "table" && (!p.x || p.series.length === 0))) return { error: "every chart panel needs x and at least one series" };
    // a flow runs from one column to another and draws one amount
    const flows = spec.panels.filter((p) => p.kind === "flow");
    if (flows.some((p) => !p.target || p.target === p.x || p.series.length !== 1)) return { error: "a flow panel needs x (the column value comes from), target (the column it goes to, not x) and one series (the amount)" };
    const text = flows.map((p) => p.series[0].column).filter((c) => !NUMERIC.test(input.columns.find((k) => k.name === c)?.type ?? ""));
    if (text.length) return { error: `a flow's series is the amount that moved: ${text.join(", ")} is not a number column` };
    // a ranking draws one bar per row: a name that repeats in the rows (a sender with several partners) would stand there several times
    const repeats = [...new Set(spec.panels.filter((p) => p.kind === "hbar" && p.x && new Set(input.rows.map((r) => String(r[p.x!]))).size < input.rows.length).map((p) => p.x!))];
    if (repeats.length) return { error: `an hbar draws one bar per row, and ${repeats.join(", ")} repeats in these rows: rank a column that names each row once, or leave the ranking out` };
    // a net is what came in less what went out: it needs an outflow drawn below zero
    if (spec.panels.some((p) => p.net && !p.series.some((s) => s.below))) return { error: "net draws each period's ins less its outs: give the outflow series below: true, or leave net out" };
    // a callout's cap counts it as the page shows it, each full address and hash short
    const long = spec.callouts.map((c, i) => ({ i, n: shownLength(c) })).filter((c) => c.n > CALLOUT_SHOWN);
    if (long.length) return { error: `a callout holds ${CALLOUT_SHOWN} characters as the page shows it, with each address and hash counted as 11: ${long.map((c) => `callout ${c.i + 1} has ${c.n}`).join(", ")}. Shorten it and call design again.` };
    // the reader never sees the columns: labels and callouts that name one are written again once, then read as words
    const named = codeWords([...labelsOf(spec), ...spec.callouts].join("\n"), [...cols]);
    if (named.length && !relabeled) {
      relabeled = true;
      return { error: `the labels or callouts have ${named.join(", ")}, words the page never shows: the reader never sees the columns, and a transaction is final, never settled. Use plain words ("Seen in 7 days", not seen_7d; final, not settled) and call design again.` };
    }
    visual = readerSpec(spec, [...cols], heldHex(input));
    return { ok: true };
  };
  const design = tool({
    description: "The visual for this answer: headline stats, one to four panels, callouts.",
    inputSchema: visualSpecSchema,
    execute: async (spec) => {
      const r = check(spec);
      if ("error" in r) refused.push(r.error.slice(0, 200));
      return r;
    },
  });

  try {
    const r = await generateText({
      model: anthropic(DESIGN_MODEL),
      providerOptions: DESIGN_OPTIONS,
      // the house style is the same for every answer; read it from the cache
      system: { role: "system", content: HOUSE_STYLE, providerOptions: { anthropic: { cacheControl: { type: "ephemeral" } } } },
      messages: [
        {
          role: "user",
          content: [
            `Question: ${input.question}`,
            `Title from the query stage: ${input.title}`,
            `Note from the query stage: ${input.note}`,
            `Native token: ${input.symbol}. Rows: ${input.rows.length}${input.totals && input.totals.rows > input.rows.length ? ` of ${input.totals.rows}` : ""}.`,
            ...rowsBrief(seen),
            `Call the design tool exactly once with the visual. If it returns an error, call it again with the fix. Do not answer in prose.`,
          ].join("\n"),
        },
      ],
      tools: { design },
      // the design call ends the run: the prose a model writes after it is read by nothing
      stopWhen: [stepCountIs(3), () => visual !== null],
      maxRetries: 1,
    });
    tally(r);
  } catch (e) {
    error = e instanceof Error ? e.message : String(e);
    console.warn("[explorer-query] designer failed:", error);
  }
  // the designer may have been told its columns were wrong once; give it one more turn
  if (!visual) {
    try {
      const r = await generateText({
        model: anthropic(DESIGN_MODEL),
        providerOptions: DESIGN_OPTIONS,
        system: HOUSE_STYLE,
        messages: [{ role: "user", content: `Question: ${input.question}\nColumns: ${[...cols].join(", ")}\nRows: ${input.rows.length}\nFirst rows:\n${sample.slice(0, 8).map((r) => JSON.stringify(r)).join("\n")}\nCall design once, using only these columns.` }],
        tools: { design },
        stopWhen: [stepCountIs(2), () => visual !== null],
        maxRetries: 1,
      });
      tally(r);
    } catch (e) {
      error = `${error ?? ""} | retry: ${e instanceof Error ? e.message : String(e)}`;
    }
  }
  return { visual: visual ?? fallback, ms: Date.now() - t0, fromDesigner: !!visual, error, steps, refused };
}
