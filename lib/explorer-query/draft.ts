import type { ColumnMeta } from "./clickhouse";
import type { ChartSpec } from "./types";
import type { Panel, Series, VisualSpec } from "./visual";

/* The layout an answer carries from the writer's chart spec until the
   designer's arrives. The page waits for the designer's and draws this
   one only when the designer is unavailable (its model fails or times
   out); a kept recipe with no layout carries it too. */

/** units that count things share one axis: transactions beside transfers, all beside reverted */
const COUNT = /^(?:|n|#|count|txs?|transactions?|transfers?|blocks?|calls?|senders?|recipients?|addresses|wallets|users|accounts|events?|swaps?|validators?|delegations?|delegators?|mints?|burns?|contracts?|holders?|messages?|registrations?|times)$/i;
const axisUnit = (unit?: string) => (COUNT.test((unit ?? "").trim()) ? "count" : (unit ?? "").trim().toLowerCase());

/** the old one-chart spec, as a visual, for when the designer is unavailable. One axis holds one unit: a series in
    another unit than the first (a rate beside a count, AVAX beside a count) goes on the right axis, drawn as a line
    over bars; a horizontal ranking has no second axis, so it goes in a half-width panel beside. On the first's axis
    it would lie flat along the bottom. A small series in the first's unit stays, as small as it is: reverted beside
    every transaction */
export function basicVisual(chart: ChartSpec, columns: ColumnMeta[]): VisualSpec {
  if (chart.kind === "none" || chart.kind === "table" || !chart.x || chart.series.length === 0) {
    return { stats: [], panels: [{ title: "Rows", kind: "table", series: [], markers: [], bands: [], stacked: false, sortDir: "desc", referenceLines: [], width: "full" }], callouts: [] };
  }
  const time = columns.find((c) => c.name === chart.x)?.type.startsWith("Date");
  const kind = chart.kind === "bar" && !time ? "hbar" : chart.kind;
  const series: Series[] = chart.series.map((s) => ({ column: s.column, label: s.label, format: /%/.test(s.unit ?? "") ? "percent" : /avax/i.test(s.unit ?? "") ? "avax" : /gas/i.test(s.unit ?? "") ? "gas" : "number", axis: "left", mark: "auto", transform: "none", dashed: false }));
  // stacked series are the parts of one whole, on one axis
  const first = axisUnit(chart.series[0].unit);
  const apart = chart.series.map((s, i) => !chart.stacked && i > 0 && axisUnit(s.unit) !== first);
  const panel = (title: string, k: Panel["kind"], ss: Series[], width: Panel["width"]): Panel => ({ title, kind: k, x: chart.x, series: ss, markers: [], bands: [], stacked: !!chart.stacked, sortDir: "desc", referenceLines: [], width });
  if (!apart.some(Boolean)) return { stats: [], panels: [panel("", kind, series, "full")], callouts: [] };
  if (kind === "hbar") {
    const [own, other] = [series.filter((_, i) => !apart[i]), series.filter((_, i) => apart[i])];
    return { stats: [], panels: [panel(own.map((s) => s.label).join(", ").slice(0, 60), "hbar", own, "half"), panel(other.map((s) => s.label).join(", ").slice(0, 60), "hbar", other, "half")], callouts: [] };
  }
  const right = series.map((s, i): Series => (apart[i] ? { ...s, axis: "right", mark: kind === "bar" ? "line" : "auto" } : s));
  return { stats: [], panels: [panel("", kind, right, "full")], callouts: [] };
}
