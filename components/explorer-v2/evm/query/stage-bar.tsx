"use client";

/* the row above the stage: the zoom trail or the hint line, and the Rows button */

import { Rows3 } from "lucide-react";
import { formatNumber } from "@/components/explorer-v2/format";
import type { QueryAnswer } from "@/lib/explorer-query/types";
import type { Selection } from "@/lib/explorer-query/selection";
import { Crumbs, type OpenDrill } from "../QueryZoom";
import { cutLine, rowCount, rowsLabel } from "../query-client";
import type { Row } from "./sheet";

export function StageBar({
  answer,
  drill,
  sel,
  picked,
  allRows,
  level,
  charted,
  canDrill,
  popZoom,
  setInspect,
}: {
  answer: QueryAnswer;
  drill: OpenDrill | null;
  sel: Selection;
  /** the answer's rows through the selection */
  picked: Row[];
  allRows: Row[];
  /** what the inspector lists: the drilled records, else the picked rows */
  level: { total: number; rows: Row[] };
  charted: boolean;
  canDrill: boolean;
  popZoom: () => void;
  setInspect: (open: boolean) => void;
}) {
  return (
    <div className="flex min-h-8 flex-wrap items-center justify-between gap-x-4 gap-y-2 px-1">
      {drill ? (
        <Crumbs items={[{ label: answer.title, onClick: popZoom }, { label: drill.title }]} />
      ) : (
        <span className="min-w-0 truncate font-mono text-[11px] tabular-nums text-zinc-400 dark:text-zinc-500">
          {sel.length ? `${formatNumber(picked.length)} of ${rowCount(allRows.length)}` : [cutLine(answer), charted ? (canDrill ? "Drag or click to filter. Open a mark with ›." : "Drag or click to filter.") : ""].filter(Boolean).join(" · ")}
        </span>
      )}
      <span className="flex items-center gap-1">
        {level.total > 0 && (
          <button
            type="button"
            onClick={() => setInspect(true)}
            aria-haspopup="dialog"
            aria-keyshortcuts="R"
            className="flex items-center gap-2 rounded-full bg-zinc-100 px-3 py-1 font-mono text-[11px] tabular-nums text-zinc-700 transition-colors hover:bg-zinc-200/80 hover:text-zinc-900 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:hover:text-zinc-50"
          >
            <Rows3 className="h-3.5 w-3.5" />
            Rows ({drill || sel.length || !answer ? formatNumber(level.rows.length) : rowsLabel(answer, level.rows.length)})
            <kbd className="hidden rounded bg-white px-1 text-[10px] text-zinc-400 sm:inline dark:bg-zinc-950 dark:text-zinc-500">R</kbd>
          </button>
        )}
      </span>
    </div>
  );
}
