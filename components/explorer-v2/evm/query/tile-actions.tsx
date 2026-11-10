"use client";

/* what a tile hands out: the SQL behind it, its own columns as CSV, and its drawing as a PNG */

import { useState, type MouseEvent } from "react";
import { toPng } from "html-to-image";
import type { ColumnMeta } from "@/lib/explorer-query/clickhouse";
import type { Names } from "@/lib/explorer-query/types";
import type { Panel } from "@/lib/explorer-query/visual-spec";
import { downloadCsv, fileName } from "../QueryRows";
import type { Row } from "./sheet";

const ACT =
  "inline-flex items-center rounded-full px-2 py-1 font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0061E2]/50 disabled:opacity-40 dark:text-zinc-500 dark:hover:bg-zinc-900 dark:hover:text-zinc-100";

/** the tile a control stands in, drawn as an image: its card, without the controls */
async function shoot(e: MouseEvent<HTMLElement>, title: string) {
  const tile = e.currentTarget.closest<HTMLElement>("[data-tile]");
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

export function TileActions({ panel, title, columns, rows, names, onSql }: { panel: Panel; /** the answer's title, for a panel that has none */ title: string; columns: ColumnMeta[]; rows: Row[]; names: Names; onSql: () => void }) {
  const [busy, setBusy] = useState(false);
  const name = panel.title || title;
  // a chart's own columns; a table panel that names none hands out every column
  const own = new Set([panel.x, panel.y, panel.target, ...panel.series.map((s) => s.column)].filter(Boolean));
  const cols = panel.kind === "table" && !panel.series.length ? columns : columns.filter((k) => own.has(k.name));
  return (
    <span className="inline-flex items-center">
      <button type="button" className={ACT} title="See the SQL behind this answer" onClick={onSql}>
        SQL
      </button>
      <button type="button" className={ACT} title={`Download ${name} as CSV`} onClick={() => downloadCsv({ title: name, columns: cols, rows, names })}>
        CSV
      </button>
      <button
        type="button"
        className={ACT}
        disabled={busy}
        title={`Download ${name} as an image`}
        onClick={(e) => {
          setBusy(true);
          void shoot(e, name).finally(() => setBusy(false));
        }}
      >
        PNG
      </button>
    </span>
  );
}
