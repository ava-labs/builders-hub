import { z } from "zod";
import type { QueryResult } from "./clickhouse";

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

export interface QueryAnswer {
  title: string;
  note: string;
  sql: string;
  chart: ChartSpec;
  drill: Drill | null;
  result: QueryResult | null;
  names: Names;
  model?: { steps: number; ms: number; tries: number };
}

export interface DrillAnswer {
  sql: string;
  result: QueryResult;
  names: Names;
}
