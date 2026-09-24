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
  sql: string;
  chart: ChartSpec;
  drill: Drill | null;
  result: QueryResult | null;
  names: Names;
  /** how the designer laid the answer out; the page draws this */
  visual: VisualSpec | null;
  /** the window of the chain the database holds, whatever the question asked */
  coverage: Coverage | null;
  /** now() was read as this block time, because the index runs behind the clock */
  anchor?: string | null;
  /** visual is the basic layout, drawn while the designer works */
  draftVisual?: boolean;
  /** the cache key of this answer's recipe; the layout is kept under it */
  key?: string;
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
  result: QueryResult;
  names: Names;
}
