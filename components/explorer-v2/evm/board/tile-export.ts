/* What a tile hands out: its rows as CSV, and its drawing as a PNG. The
   image is the tile's card (data-tile) without its controls
   (data-no-shot), as an answer's tile makes its own (query/tile-actions.tsx). */

import { toPng } from "html-to-image";
import type { Snapshot } from "@/lib/explorer-query/board";
import type { Panel } from "@/lib/explorer-query/visual-spec";
import { downloadCsv, fileName } from "@/components/explorer-v2/evm/QueryRows";

/** a tile's rows as CSV: one panel's own columns, or every column for a whole answer, its figures, a metric
    tile or a table that names none */
export function downloadTileCsv(title: string, snap: Snapshot, panel?: Panel) {
  const own = new Set(panel && (panel.kind !== "table" || panel.series.length) ? [panel.x, panel.y, panel.target, ...panel.series.map((s) => s.column)] : []);
  const columns = snap.columns.filter((k) => own.has(k.name));
  downloadCsv({ title, columns: columns.length ? columns : snap.columns, rows: snap.rows, names: snap.names });
}

/** the tile an element stands in, drawn as an image */
export async function downloadTilePng(inside: HTMLElement | null, title: string) {
  const tile = inside?.closest<HTMLElement>("[data-tile]");
  if (!tile) return;
  const url = await toPng(tile, {
    pixelRatio: 2,
    backgroundColor: getComputedStyle(tile).backgroundColor,
    filter: (n) => !(n instanceof HTMLElement && n.dataset.noShot !== undefined),
  });
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName(title, "png");
  link.click();
}
