/* the visual grammar: what the designer may put on the sheet, and the page knows how to draw */

import { z } from "zod";

/** the most characters a callout shows; it names addresses and hashes in full, and the page draws each short */
export const CALLOUT_SHOWN = 160;
/** a callout's cap as written: the shown cap and room for six full hashes, so naming transactions never fails a schema */
export const CALLOUT_RAW = CALLOUT_SHOWN + 6 * 55;

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
