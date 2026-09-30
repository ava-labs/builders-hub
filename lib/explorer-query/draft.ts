import type { ColumnMeta } from "./clickhouse";
import type { ChartSpec } from "./types";
import type { VisualSpec } from "./visual";

/* The layout an answer carries from the writer's chart spec until the
   designer's arrives. The page waits for the designer's and draws this
   one only when the designer is unavailable (its model fails or times
   out); a kept recipe with no layout carries it too. */

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
