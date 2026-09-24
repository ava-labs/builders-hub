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

export const panelSchema = z.object({
  title: z.string().max(60),
  /** hbar: a horizontal ranking; bar: buckets; line and area: continuous; table: the rows */
  kind: z.enum(["hbar", "bar", "line", "area", "table"]),
  /** the category or time column */
  x: z.string().optional(),
  series: z
    .array(
      z.object({
        column: z.string(),
        label: z.string().max(32),
        format: formatSchema.default("number"),
        /** a second axis for a series in different units */
        axis: z.enum(["left", "right"]).default("left"),
      }),
    )
    .max(5)
    .default([]),
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
    return { stats: [], panels: [{ title: "Rows", kind: "table", series: [], stacked: false, sortDir: "desc", referenceLines: [], width: "full" }], callouts: [] };
  }
  const time = columns.find((c) => c.name === chart.x)?.type.startsWith("Date");
  return {
    stats: [],
    panels: [
      {
        title: "",
        kind: chart.kind === "bar" && !time ? "hbar" : chart.kind,
        x: chart.x,
        series: chart.series.map((s) => ({ column: s.column, label: s.label, format: /%/.test(s.unit ?? "") ? "percent" : /avax/i.test(s.unit ?? "") ? "avax" : /gas/i.test(s.unit ?? "") ? "gas" : "number", axis: "left" })),
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

export async function designVisual(input: DesignInput): Promise<{ visual: VisualSpec; ms: number; fromDesigner: boolean; error?: string }> {
  const t0 = Date.now();
  const fallback = basicVisual(input.chart, input.columns);
  if (input.rows.length === 0) return { visual: fallback, ms: 0, fromDesigner: false };
  let error: string | undefined;

  // the rows as the designer sees them: names where the server found them
  const sample = input.rows.slice(0, 15).map((r) => {
    const o: Row = {};
    for (const c of input.columns) {
      const v = r[c.name];
      const name = typeof v === "string" ? input.names[c.name]?.[v.toLowerCase()] : undefined;
      o[c.name] = name ? `${name} (${String(v).slice(0, 10)}…)` : v;
    }
    return o;
  });
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
      system: HOUSE_STYLE,
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
