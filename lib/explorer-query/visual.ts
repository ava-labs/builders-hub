/* The designer. Once the query has run, a second model looks at the
   question and the actual rows and decides how they should be shown:
   which panels, which chart in each, what the headline figures are,
   where a reference line belongs, and what a reader should notice.
   It speaks a small visual grammar the page knows how to draw. */

import { createAnthropic } from "@ai-sdk/anthropic";
import { generateText, stepCountIs, tool } from "ai";
import { z } from "zod";
import type { ColumnMeta } from "./clickhouse";
import type { ChartSpec, Names } from "./types";

const anthropic = createAnthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
export const DESIGN_MODEL = "claude-opus-5-5";

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
});
export type Series = z.infer<typeof seriesSchema>;

export const panelSchema = z.object({
  title: z.string().max(60),
  /** hbar: a horizontal ranking; bar: buckets; line and area: continuous;
   *  scatter: one numeric column against another; table: the rows */
  kind: z.enum(["hbar", "bar", "line", "area", "scatter", "table"]),
  /** the category or time column; for scatter, the numeric x column */
  x: z.string().optional(),
  series: z.array(seriesSchema).max(6).default([]),
  /** vertical marks at x values: a peak, an upgrade, the start of a burst */
  markers: z.array(z.object({ x: z.union([z.string(), z.number()]), label: z.string().max(28) })).max(4).default([]),
  /** shaded x ranges: the window being compared, an incident */
  bands: z.array(z.object({ from: z.union([z.string(), z.number()]), to: z.union([z.string(), z.number()]), label: z.string().max(28) })).max(2).default([]),
  stacked: z.boolean().default(false),
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
  /** one to three sentences a reader should take away, grounded in the rows */
  callouts: z.array(z.string().max(160)).max(3).default([]),
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

function summarize(columns: ColumnMeta[], rows: Row[]) {
  return columns.map((c) => {
    const vals = rows.map((r) => r[c.name]);
    const nums = vals.filter((v): v is number => typeof v === "number");
    if (nums.length) {
      const sum = nums.reduce((a, b) => a + b, 0);
      return `${c.name} (${c.type}): min ${Math.min(...nums)}, max ${Math.max(...nums)}, sum ${sum}, avg ${(sum / nums.length).toPrecision(4)}`;
    }
    const distinct = new Set(vals.map(String)).size;
    return `${c.name} (${c.type}): ${distinct} distinct, e.g. ${String(vals[0]).slice(0, 40)}`;
  });
}

const HOUSE_STYLE = `You design the visual for an answer on the Avalanche explorer (build.avax.network). The page is a drafting sheet: mono labels, one red accent (#E6212F) then blue, teal, amber; thin lines; no decoration. Your job is to decide what a careful analyst would put on the sheet so the reader sees the answer in two seconds and can check it in ten.

Rules of the sheet
- Rankings (methods, contracts, senders) are horizontal bars (hbar) with the name on the axis, top 10 to 15, sorted by the figure that answers the question. A share or a reverted count that belongs to the same rows goes in a second half-width panel, not as a second series squeezed onto the same axis.
- Time series are lines; counts over buckets are bars; parts of a whole over time are stacked areas or stacked bars. Never put a count and a percent on the same axis; use axis "right" or a second panel.
- Gas reserved against a limit: a line with the limit as a reference line. Fees in AVAX use format avax. Gas figures use format gas (compact with the word gas). Percent columns use percent.
- Two to four headline stats across the top, the figures a developer would quote: the total, the leader's share, the failure rate when reverts matter, how many distinct callers. Labels are the plain noun a person says ("Transactions", "Reverted", "Callers", "Fees burned"), never "Top 15 txs". Use agg over a column of the rows (sum for counts and fees, max for peaks, avg for rates, distinct for how many groups). The sub line gives the context in five words or fewer, with a name or figure where it helps ("sweep leads", "of all calls").
- Callouts: at most three sentences a developer would act on, each with a name and a figure from the rows: concentration (one sender behind a method), failure (a method that always reverts), cost (who pays the most gas). No adjectives, no restating the chart title. Do not mention the data window or coverage; the page shows it. No em dashes. Never say "settled" or "waiting".
- Panel titles: two to four plain words, no "by" chains longer than one.
Comparisons and overlays (use them whenever the rows hold more than one thing to compare)
- Two groups or two periods in columns (usdc_*, usdt_*; current_*, previous_*): overlay them in ONE panel. The baseline or previous period is dashed.
- Things of very different size (a token with 1,000x the volume of another): transform "indexed" rebases each to 100 at its first point, so shape is compared, not size. Say so in the panel title ("indexed to 100").
- Parts of a whole over time: transform "share" on each part plus stacked area, so each bucket sums to 100%.
- Running totals: transform "cumulative". Noisy per-minute series: add a "rolling" copy of the same column as a thin line over the raw bars.
- A count and a rate together: bars (mark "bar") on the left axis, the rate as a line (mark "line") on the right axis.
- Two numeric measures per group or per record (gas against fee, calls against callers): kind "scatter", x the first measure, one series the second.
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
}

/** the rows as a model sees them: names where the server found them */
function sampleRows(input: Pick<DesignInput, "rows" | "columns" | "names">, n: number): Row[] {
  return input.rows.slice(0, n).map((r) => {
    const o: Row = {};
    for (const c of input.columns) {
      const v = r[c.name];
      const name = typeof v === "string" ? input.names[c.name]?.[v.toLowerCase()] : undefined;
      o[c.name] = name ? `${name} (${String(v).slice(0, 10)}…)` : v;
    }
    return o;
  });
}

const READER_MODEL = "claude-haiku-4-5-20251001";

/** fresh callouts for a kept layout: the layout outlives its rows, the
    sentences do not, so a fast model writes them again from these rows */
export async function writeReading(input: Omit<DesignInput, "chart">): Promise<string[]> {
  if (input.rows.length === 0) return [];
  let out: string[] = [];
  const reading = tool({
    description: "One to three callouts on these rows.",
    inputSchema: z.object({ callouts: z.array(z.string().max(160)).max(3) }),
    execute: async ({ callouts }) => {
      out = callouts.map((c) => c.replace(/\u2014/g, ",")).slice(0, 3);
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
        "Quote only figures you can see in the rows or the column summaries. Call the reading tool once.",
      ].join("\n"),
      messages: [
        {
          role: "user",
          content: [
            `Question: ${input.question}`,
            `Title: ${input.title}`,
            `Native token: ${input.symbol}. Rows: ${input.rows.length}.`,
            `Columns and summaries:`,
            ...summarize(input.columns, input.rows).map((s) => `- ${s}`),
            `First rows:`,
            ...sampleRows(input, 15).map((r) => JSON.stringify(r)),
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
  return out;
}

export async function designVisual(input: DesignInput): Promise<{ visual: VisualSpec; ms: number; fromDesigner: boolean; error?: string }> {
  const t0 = Date.now();
  const fallback = basicVisual(input.chart, input.columns);
  if (input.rows.length === 0) return { visual: fallback, ms: 0, fromDesigner: false };
  let error: string | undefined;

  const sample = sampleRows(input, 15);
  const cols = new Set(input.columns.map((c) => c.name));

  let visual: VisualSpec | null = null;
  const design = tool({
    description: "The visual for this answer: headline stats, one to four panels, callouts.",
    inputSchema: visualSpecSchema,
    execute: async (spec) => {
      const bad = [
        ...spec.stats.filter((s) => !cols.has(s.column)).map((s) => `stat ${s.label} -> ${s.column}`),
        ...spec.panels.flatMap((p) => [...(p.x && !cols.has(p.x) ? [`panel x ${p.x}`] : []), ...p.series.filter((s) => !cols.has(s.column)).map((s) => `series ${s.column}`), ...(p.sortBy && !cols.has(p.sortBy) ? [`sortBy ${p.sortBy}`] : [])]),
      ];
      if (bad.length) return { error: `these columns are not in the rows: ${bad.join("; ")}. Columns: ${[...cols].join(", ")}` };
      if (spec.panels.some((p) => p.kind !== "table" && (!p.x || p.series.length === 0))) return { error: "every chart panel needs x and at least one series" };
      visual = spec;
      return { ok: true };
    },
  });

  try {
    await generateText({
      model: anthropic(DESIGN_MODEL),
      // the house style is the same for every answer; read it from the cache
      system: { role: "system", content: HOUSE_STYLE, providerOptions: { anthropic: { cacheControl: { type: "ephemeral" } } } },
      messages: [
        {
          role: "user",
          content: [
            `Question: ${input.question}`,
            `Title from the query stage: ${input.title}`,
            `Note from the query stage: ${input.note}`,
            `Native token: ${input.symbol}. Rows: ${input.rows.length}.`,
            `Columns and summaries:`,
            ...summarize(input.columns, input.rows).map((s) => `- ${s}`),
            `First rows:`,
            ...sample.map((r) => JSON.stringify(r)),
            `Call the design tool exactly once with the visual. If it returns an error, call it again with the fix. Do not answer in prose.`,
          ].join("\n"),
        },
      ],
      tools: { design },
      stopWhen: [stepCountIs(3)],
      maxRetries: 1,
    });
  } catch (e) {
    error = e instanceof Error ? e.message : String(e);
    console.warn("[explorer-query] designer failed:", error);
  }
  // the designer may have been told its columns were wrong once; give it one more turn
  if (!visual) {
    try {
      await generateText({
        model: anthropic(DESIGN_MODEL),
        system: HOUSE_STYLE,
        messages: [{ role: "user", content: `Question: ${input.question}\nColumns: ${[...cols].join(", ")}\nRows: ${input.rows.length}\nFirst rows:\n${sample.slice(0, 8).map((r) => JSON.stringify(r)).join("\n")}\nCall design once, using only these columns.` }],
        tools: { design },
        stopWhen: [stepCountIs(2)],
        maxRetries: 1,
      });
    } catch (e) {
      error = `${error ?? ""} | retry: ${e instanceof Error ? e.message : String(e)}`;
    }
  }
  return { visual: visual ?? fallback, ms: Date.now() - t0, fromDesigner: !!visual, error };
}
