import type { DrillProfile } from "./drill-profile";
import type { MonitorSpec } from "./monitor";
import { z } from "zod";
import type { Coverage, QueryResult } from "./clickhouse";
import type { VisualSpec } from "./visual";

/* The shapes that cross from the query route to the page. */

export const chartSpecSchema = z.object({
  kind: z.enum(["line", "bar", "area", "table", "none"]),
  x: z.string().optional().describe("column on the horizontal axis"),
  series: z
    .array(
      z.object({
        column: z.string(),
        label: z.string(),
        unit: z.string().optional(),
      }),
    )
    .max(6)
    .default([]),
  stacked: z.boolean().optional(),
});
export type ChartSpec = z.infer<typeof chartSpecSchema>;

/** how one row of the answer opens into the records behind it */
export const drillSchema = z.object({
  /** a SELECT with {{column}} placeholders for the picked row's values */
  sql: z.string(),
  /** what the record list is called, same placeholders: "Calls to {{method_id}} on {{t}}" */
  title: z.string(),
});
export type Drill = z.infer<typeof drillSchema>;

/** decoded names the server found: column -> raw value (lowercase) -> label */
export type Names = Record<string, Record<string, string>>;

/** one earlier question and the query it produced, so a follow-up can refine it */
export interface Turn {
  prompt: string;
  sql: string;
  title: string;
}

/** a reference table an answer read (sources.ts), and how much of its
    set it knows. Made on every run, never kept with a recipe, so its
    figures are always the rows' own */
export interface SourceNote {
  /** the table the SQL names */
  table: string;
  /** what the table is, for the reader, mid-sentence: "validator versions" */
  label: string;
  /** unix ms our server read the source */
  at: number;
  /** members of the set, and those the table's figure is known for */
  total: number;
  known: number;
  /** the coverage and where the figure comes from, in plain sentences */
  text: string;
}

/** the whole result when the rows stop at a LIMIT: its size and each column's figures, read once past the limit */
export interface Totals {
  rows: number;
  /** the rows shown are a time series' newest, not its first */
  newest: boolean;
  sum: Record<string, number>;
  /** the rows that hold a number in each column, for an average */
  count: Record<string, number>;
  min: Record<string, number>;
  max: Record<string, number>;
  distinct: Record<string, number>;
  /** the column the rows are known by, and its value in the row that holds each column's max and min */
  label?: string;
  maxAt?: Record<string, string>;
  minAt?: Record<string, string>;
}

/** one model step, timed: what the model spent thinking and what the database spent */
export interface StepTiming {
  n: number;
  kind: "test" | "final";
  writer: string;
  modelMs: number;
  sqlMs: number;
  ok: boolean;
  /** rows back, or the error */
  detail: string;
}

export interface QueryAnswer {
  title: string;
  note: string;
  /** the window the answer reads, as a figure over all of it says it ("last 6 hours"), or null for none */
  span?: string | null;
  sql: string;
  chart: ChartSpec;
  drill: Drill | null;
  result: QueryResult | null;
  /** when the rows stop at a LIMIT: how many the query had, and its figures over all of them */
  totals?: Totals | null;
  names: Names;
  /** how the designer laid the answer out; the page draws this */
  visual: VisualSpec | null;
  /** the window of the chain the database holds, whatever the question asked */
  coverage: Coverage | null;
  /** now() was read as this block time, because the index runs behind the clock */
  anchor?: string | null;
  /** the reference tables the SQL read, with their coverage */
  sources?: SourceNote[];
  /** visual is the basic layout, drawn while the designer works */
  draftVisual?: boolean;
  /** the cache key of this answer's recipe; the layout is kept under it */
  key?: string;
  /** the PostHog trace of the question that made this answer: its layout and its reading are counted under it */
  trace?: string;
  /** the question belongs to the other chain's data; the page asks it there */
  route?: "p-chain" | "c-chain";
  /** a live monitor: no SQL ran, and the page reads the chain's RPC for it (monitor.ts) */
  monitor?: MonitorSpec;
  model?: {
    steps: number;
    ms: number;
    tries: number;
    designMs?: number;
    designer?: boolean;
    designError?: string;
    /** the model that wrote the SQL */
    writer?: string;
    /** answered from a kept recipe, no model asked */
    cached?: boolean;
    timings?: StepTiming[];
    /** input tokens read from the prompt cache, of all input tokens */
    cacheRead?: number;
    inputTokens?: number;
  };
}

export interface DrillAnswer {
  sql: string;
  anchor?: string | null;
  sources?: SourceNote[];
  result: QueryResult;
  names: Names;
  /** a ranked drill's whole population over the opened bucket, in bins (drill-profile.ts) */
  profile?: DrillProfile | null;
}
