"use client";

/* the answer's stage: the live monitor, the drilled records, the layout loader, the chart, one row's figures, the rows, or the empty line */

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { truncate } from "@/components/explorer-v2/format";
import type { Names, QueryAnswer, Turn } from "@/lib/explorer-query/types";
import type { VisualSpec } from "@/lib/explorer-query/visual-spec";
import type { Selection } from "@/lib/explorer-query/selection";
import { isAddress } from "@/lib/explorer-query/values";
import { rowBase } from "@/lib/explorer-query/target";
import { QueryVisual } from "../QueryVisual";
import { fmt, nameFor } from "../query-format";
import { PanelRows, formatOf, header } from "../QueryRows";
import { PinToBoard } from "../QueryBoard";
import { RowsBody } from "../QueryInspector";
import { DrillView, type OpenDrill } from "../QueryZoom";
import { QueryMonitor } from "../QueryMonitor";
import { NO_QUERY } from "../query-client";
import { SkeletonGrid } from "./answer-skeleton";
import { CARD, type Row } from "./sheet";
import type { Prior } from "./stat-figures";
import { TileActions } from "./tile-actions";

export function AnswerStage({
  answer,
  visual,
  drawn,
  drill,
  laying,
  charted,
  canDrill,
  recordRows,
  pinnable,
  allRows,
  picked,
  names,
  history,
  c,
  network,
  base,
  sym,
  sel,
  setSel,
  range,
  setRange,
  hoverKey,
  setHoverKey,
  hoverTx,
  setHoverTx,
  setInspect,
  openRow,
  openDrill,
  ask,
  prior,
  onSql,
  lead,
}: {
  answer: QueryAnswer;
  visual: VisualSpec | null;
  /** the visual with its cut edge buckets labelled, when it has any */
  drawn: VisualSpec | null;
  drill: OpenDrill | null;
  laying: boolean;
  charted: boolean;
  canDrill: boolean;
  recordRows: boolean;
  pinnable: boolean;
  allRows: Row[];
  /** the answer's rows through the selection */
  picked: Row[];
  names: Names;
  history: Turn[];
  c: { chainSlug?: string };
  network: string;
  base: string;
  sym: string;
  sel: Selection;
  setSel: (s: Selection) => void;
  range: [number, number] | null;
  setRange: (r: [number, number] | null) => void;
  hoverKey: unknown;
  setHoverKey: (k: unknown) => void;
  hoverTx: string | null;
  setHoverTx: (h: string | null) => void;
  setInspect: (open: boolean) => void;
  openRow: (r: Row) => void;
  openDrill: (row: Row, index: number) => Promise<void>;
  ask: (q: string, refine: boolean) => Promise<unknown>;
  /** the answer's query over the period before its window, once read */
  prior: Prior | null;
  /** show the SQL behind the answer */
  onSql: () => void;
  /** the findings, set between the figures and the panels */
  lead?: ReactNode;
}) {
  return answer.monitor ? (
    // a live feed of the chain's own moves, read from its RPC as each block is made
    <QueryMonitor spec={answer.monitor} base={base} />
  ) : drill ? (
    <div className={cn(CARD, "px-4 py-4 sm:px-5 sm:py-5")}>
      <DrillView drill={drill} base={rowBase(base, drill.row) ?? base} sym={sym} hoverTx={hoverTx} onHoverTx={setHoverTx} onRows={() => setInspect(true)} />
    </div>
  ) : laying ? (
    // one draw: the grid's frame holds the space until the layout is final
    <SkeletonGrid status="Rows are in. Laying out the chart" />
  ) : charted && visual ? (
    <QueryVisual
      visual={drawn ?? visual}
      rows={allRows}
      names={names}
      sym={sym}
      totals={answer.totals}
      span={answer.span}
      prior={prior}
      lead={lead}
      base={base}
      canDrill={canDrill || recordRows}
      // a mark that is one thing on the chain (a transaction, a
      // contract, a validator, a block) opens that thing's own page
      onPick={openRow}
      hoverKey={hoverKey}
      onHoverKey={setHoverKey}
      range={range}
      onRange={setRange}
      onZoom={(lo, hi) => void ask(`Only between ${String(lo)} and ${String(hi)} inclusive, same figures, finer buckets if that helps.`, true)}
      selection={sel}
      onSelection={setSel}
      panelAction={(i) => (
        <span className="inline-flex items-center">
          <TileActions panel={visual.panels[i]} title={answer.title} columns={answer.result?.columns ?? []} rows={picked} names={names} onSql={onSql} />
          {pinnable && <PinToBoard chain={c.chainSlug!} network={network} answer={answer} panelIndex={i} thread={history.map((t) => t.prompt)} />}
        </span>
      )}
      // the designer's tables: the rows in its columns, each row a door
      renderTable={(p) => (
        <PanelRows
          panel={p}
          columns={answer.result?.columns ?? []}
          rows={picked}
          names={names}
          visual={visual}
          base={base}
          sym={sym}
          onPick={canDrill || recordRows ? openRow : undefined}
          onAll={() => setInspect(true)}
        />
      )}
    />
  ) : allRows.length === 1 ? (
    // one row is a set of figures: each column on its own card
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
      {(answer.result?.columns ?? []).map((col) => {
        const v = allRows[0][col.name];
        const f = formatOf(col.name, visual);
        return (
          <div key={col.name} className={cn(CARD, "flex min-w-0 flex-col gap-2 px-4 py-4 sm:px-5 sm:py-5")}>
            <span className="truncate font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">{header(col.name)}</span>
            <span className="truncate font-mono text-[22px] leading-none tabular-nums tracking-tight text-zinc-900 sm:text-[26px] dark:text-zinc-50">
              {typeof v === "number" ? fmt(v, f, sym) : (nameFor(names, col.name, v) ?? (isAddress(v) ? truncate(String(v), 6) : String(v ?? "")))}
            </span>
          </div>
        );
      })}
    </div>
  ) : allRows.length ? (
    // no chart to index the rows: the rows, by their shape, are the view
    <div className={cn(CARD, "px-2 py-3")}>
      <RowsBody
        columns={answer.result?.columns ?? []}
        rows={allRows}
        names={names}
        visual={visual}
        base={base}
        sym={sym}
        onOpen={canDrill ? (r) => void openDrill(r, allRows.indexOf(r)) : undefined}
      />
    </div>
  ) : (
    <p className={cn(CARD, "px-5 py-10 font-mono text-[12px] text-zinc-500")}>{answer.result ? "The query returned no rows." : NO_QUERY}</p>
  );
}
