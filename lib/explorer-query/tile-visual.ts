/* What a chart tile draws: its slice of the answer's layout, with each
   panel in a kind the tile's rows still hold. The designer checks a kind
   against the rows once (kind-checks.ts); a tile's rows change at every
   refresh, and a view can come from a link or another device, so the
   tile checks again each time it draws. */

import type { ChartTile } from "./board";
import { kindError } from "./kind-checks";
import type { Panel, VisualSpec } from "./visual-spec";

/** the kinds with a drawing of their own, each with needs of the rows it draws */
const OWN = new Set<Panel["kind"]>(["dumbbell", "diverging", "histogram", "heatmap", "treemap"]);

/** a panel in the kind the tile draws it in: the reader's view when the rows hold it, else the designer's kind,
    else the bars (for a histogram, the table) the designer is told to use in its place */
function fitted(p: Panel, view: Panel["kind"] | undefined, t: ChartTile): Panel {
  const snap = t.snapshot;
  // with no rows yet the tile draws nothing, so the kind stands as it is
  const fits = (kind: Panel["kind"]) => !OWN.has(kind) || !snap || kindError([{ ...p, kind }], snap.columns, snap.rows, t.sql, !!snap.cut) === null;
  const kind = view && fits(view) ? view : p.kind;
  return { ...p, kind: fits(kind) ? kind : kind === "histogram" ? "table" : "hbar" };
}

/** the tile's slice of the answer: its figures alone, one panel alone, or all of it */
export function tileVisual(t: ChartTile): VisualSpec {
  if (t.figures) return { stats: t.visual.stats, callouts: [], panels: [] };
  if (t.panelIndex === null) return { ...t.visual, panels: t.visual.panels.map((p) => fitted(p, undefined, t)) };
  const p = t.visual.panels[t.panelIndex] ?? t.visual.panels[0];
  return { stats: [], callouts: [], panels: [{ ...fitted(p, t.view, t), width: "full" }] };
}
