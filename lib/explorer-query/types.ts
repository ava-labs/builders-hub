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
  result: QueryResult | null;
  model?: { steps: number; ms: number; tries: number };
}
