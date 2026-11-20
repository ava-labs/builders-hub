"use client";

/* The canvas: a board's header, its tiles on the grid, and the sheet a
   tile's rows open in. */

import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { SortableContext, arrayMove, rectSortingStrategy, sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { ArrowUpRight, Check, CopyPlus, Link2, Plus, RotateCw, StickyNote, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { SyncState } from "@/lib/explorer-query/board-sync";
import { askHref, boardHref, boardScope, boardsHref, noteTile, sortedTiles, type Board, type ChartTile, type Tile } from "@/lib/explorer-query/board";
import { metricTitle, metricVisual, windowText } from "@/lib/explorer-query/stats-metrics";
import type { ColumnMeta } from "@/lib/explorer-query/clickhouse";
import { tileVisual } from "@/lib/explorer-query/tile-visual";
import type { DrillAnswer, Names } from "@/lib/explorer-query/types";
import type { VisualSpec } from "@/lib/explorer-query/visual-spec";
import { fillTitle, isTxList, rowDoor } from "@/components/explorer-v2/evm/QueryRows";
import { QueryInspector } from "@/components/explorer-v2/evm/QueryInspector";
import { ago, useNow } from "@/components/explorer-v2/evm/query-board-bits";
import { ShareBoard, SyncNote } from "./board-share";
import { InlineName, btn, primary, useCopied, type BoardApi, type BoardPageProps, type Row, type TileCtx } from "./parts";
import { SPAN, SortableTile, TileFrame } from "./tile-frame";

/** one level of the board's sheet: a tile's rows, or the records behind one of them */
interface SheetLevel {
  title: string;
  sub?: string;
  columns: ColumnMeta[];
  rows: Row[];
  names: Names;
  visual: VisualSpec | null;
  busy?: boolean;
  error?: string | null;
  /** a row opens its records */
  onOpen?: (row: Row) => void;
  /** the query the rows came from */
  sql?: string;
}

/** a board the reader does not own: where its link is, and how to keep a copy */
interface Guest {
  /** the board's own page, or null for a link that carried the board itself */
  link: string | null;
  onSave: () => void;
}

export function BoardCanvas({ board, props, api, sync, guest }: { board: Board; props: BoardPageProps; api: BoardApi; sync: SyncState; guest?: Guest }) {
  const scope = boardScope(props.network, props.chainSlug);
  const router = useRouter();
  const now = useNow();
  const readOnly = !!guest;
  const base = `/explorer/${props.network}/${props.chainSlug}`;
  const tiles = sortedTiles(board);
  const ids = tiles.map((t) => t.id);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [refreshSignal, setRefreshSignal] = useState(0);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [copied, copy] = useCopied();

  // the sheet: a tile's rows, and the records one of them opens into;
  // closed, it keeps its last level so it slides away drawn
  const [sheet, setSheet] = useState<SheetLevel[]>([]);
  const [sheetOpen, setSheetOpen] = useState(false);
  const drillRun = useRef(0);
  const level = sheet[sheet.length - 1];

  const drill = async (t: ChartTile, row: Row, stacked: boolean) => {
    const snap = t.snapshot;
    if (!t.drill || !snap) return;
    const my = ++drillRun.current;
    const next: SheetLevel = { title: t.title || t.question, sub: fillTitle(t.drill.title, row, snap.names), columns: [], rows: [], names: {}, visual: null, busy: true };
    setSheet((s) => (stacked ? [...s, next] : [next]));
    setSheetOpen(true);
    const land = (patch: Partial<SheetLevel>) => {
      if (my === drillRun.current) setSheet((s) => s.map((l, i) => (i === s.length - 1 ? { ...l, ...patch, busy: false } : l)));
    };
    try {
      const res = await fetch("/api/explorer/query", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ chainId: props.chainId, drill: { sql: t.drill.sql, row } }),
      });
      const out = (await res.json().catch(() => ({}))) as Partial<DrillAnswer> & { error?: string };
      if (!res.ok || out.error || !out.result) throw new Error(out.error ?? `HTTP ${res.status}`);
      land({ columns: out.result.columns, rows: out.result.rows, names: out.names ?? {}, sql: out.sql });
    } catch (e) {
      land({ error: e instanceof Error ? e.message : "The records did not load." });
    }
  };

  const ctx: TileCtx = {
    scope,
    boardId: board.id,
    chainId: props.chainId,
    network: props.network,
    chainSlug: props.chainSlug,
    sym: props.sym,
    base,
    api,
    readOnly,
    onRows: (t, given) => {
      const snap = given ?? t.snapshot;
      if (!snap) return;
      drillRun.current++;
      // the sheet shows a sub in place of the title and names the CSV by it, so the window rides in the title
      if (t.kind === "metric") setSheet([{ title: `${metricTitle(t)} · ${windowText(t)}`, columns: snap.columns, rows: snap.rows, names: {}, visual: metricVisual(t) }]);
      else setSheet([{ title: t.title || t.question, columns: snap.columns, rows: snap.rows, names: snap.names, visual: tileVisual(t), sql: t.sql, onOpen: t.drill && !isTxList(snap.columns) ? (r) => void drill(t, r, true) : undefined }]);
      setSheetOpen(true);
    },
    onMark: (t, row) => {
      const snap = t.snapshot;
      const door = snap ? rowDoor(row, snap.columns, tileVisual(t), base) : null;
      if (door) router.push(door);
      else void drill(t, row, false);
    },
    onDrill: (t, row) => void drill(t, row, false),
  };

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const onDragStart = (e: DragStartEvent) => setActiveId(String(e.active.id));
  const onDragEnd = (e: DragEndEvent) => {
    setActiveId(null);
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const from = ids.indexOf(String(active.id));
    const to = ids.indexOf(String(over.id));
    if (from >= 0 && to >= 0) api.reorder(board.id, arrayMove(ids, from, to));
  };
  const active = tiles.find((t) => t.id === activeId);

  const addNote = () => {
    const t = api.addTile(board.id, noteTile());
    setEditing(t.id);
  };
  const charts = tiles.filter((t) => t.kind !== "note").length;
  const frame = (t: Tile) => <TileFrame tile={t} ctx={ctx} editing={false} onEditing={() => {}} refreshSignal={refreshSignal} />;

  return (
    <div className="flex flex-col gap-8 pt-4">
      {/* the board's header */}
      <div className="flex flex-col gap-4">
        <nav aria-label="Breadcrumb" className="flex items-center gap-2 font-mono text-[10.5px] uppercase tracking-[0.14em] text-zinc-400 dark:text-zinc-500">
          <Link href={askHref(props.network, props.chainSlug)} className="transition-colors hover:text-zinc-900 dark:hover:text-zinc-100">
            Query
          </Link>
          <span className="text-zinc-300 dark:text-zinc-700">/</span>
          <Link href={boardsHref(props.network, props.chainSlug)} className="transition-colors hover:text-zinc-900 dark:hover:text-zinc-100">
            Boards
          </Link>
        </nav>
        <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
          <div className="flex min-w-0 flex-1 flex-col gap-1.5">
            {readOnly ? (
              <h1 className="max-w-2xl truncate py-0.5 text-[28px] font-semibold tracking-tight text-zinc-900 sm:text-[32px] dark:text-zinc-50">{board.name}</h1>
            ) : (
              <InlineName
                value={board.name}
                placeholder="Board name"
                onSave={(v) => api.rename(board.id, v)}
                className="-ml-2 w-full max-w-2xl px-2 py-0.5 text-[28px] font-semibold tracking-tight text-zinc-900 sm:text-[32px] dark:text-zinc-50"
              />
            )}
            <p className="font-mono text-[11px] text-zinc-400 dark:text-zinc-500">
              {tiles.length} {tiles.length === 1 ? "tile" : "tiles"}
              {board.updatedAt > 0 && ` · updated ${ago(board.updatedAt, now)}`} · {readOnly ? "view only" : <SyncNote sync={sync} />}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {!readOnly && (
              <button type="button" onClick={addNote} className={btn}>
                <StickyNote className="h-3.5 w-3.5" /> Note
              </button>
            )}
            <button type="button" onClick={() => setRefreshSignal((n) => n + 1)} disabled={charts === 0} className={btn}>
              <RotateCw className="h-3.5 w-3.5" /> Refresh all
            </button>
            {guest ? (
              <>
                <button type="button" onClick={() => copy(guest.link ? `${window.location.origin}${guest.link}` : window.location.href)} className={btn}>
                  {copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Link2 className="h-3.5 w-3.5" />} {copied ? "Link copied" : "Copy link"}
                </button>
                <button type="button" onClick={guest.onSave} className={primary}>
                  <CopyPlus className="h-3.5 w-3.5" /> Save a copy
                </button>
              </>
            ) : (
              <>
                <ShareBoard link={boardHref(props.network, props.chainSlug, board.id)} sync={sync} disabled={tiles.length === 0} />
                <Link href={askHref(props.network, props.chainSlug)} className={primary}>
                  <Plus className="h-3.5 w-3.5" /> Ask
                </Link>
              </>
            )}
          </div>
        </div>
      </div>

      {tiles.length === 0 ? (
        <div className="flex flex-col items-center gap-5 rounded-3xl border border-dashed border-zinc-300 px-6 py-20 text-center dark:border-zinc-800">
          <div className="grid grid-cols-3 gap-1.5 opacity-60" aria-hidden>
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <span key={i} className={cn("h-5 rounded-[5px] border border-zinc-200 dark:border-zinc-800", i === 0 ? "col-span-2" : i === 3 ? "col-span-3" : "col-span-1")} />
            ))}
          </div>
          {readOnly ? (
            <p className="text-[18px] font-medium tracking-tight text-zinc-900 dark:text-zinc-50">This board is empty</p>
          ) : (
            <>
              <div className="flex flex-col gap-1.5">
                <p className="text-[18px] font-medium tracking-tight text-zinc-900 dark:text-zinc-50">This board is empty</p>
                <p className="max-w-sm text-[14px] leading-relaxed text-zinc-500 dark:text-zinc-400">Ask a question, then pin its chart here. Add a note for a heading or a line of context.</p>
              </div>
              <div className="flex items-center gap-2">
                <Link
                  href={askHref(props.network, props.chainSlug)}
                  className="inline-flex items-center gap-1.5 rounded-full bg-zinc-900 px-4 py-2 font-mono text-[11px] font-bold uppercase tracking-[0.12em] text-zinc-50 transition-opacity hover:opacity-85 dark:bg-zinc-50 dark:text-zinc-900"
                >
                  Ask a question <ArrowUpRight className="h-3.5 w-3.5" />
                </Link>
                <button type="button" onClick={addNote} className={btn}>
                  <StickyNote className="h-3.5 w-3.5" /> Add a note
                </button>
              </div>
            </>
          )}
        </div>
      ) : readOnly ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-12">
          {tiles.map((t) => (
            <div key={t.id} className={cn("col-span-1 min-w-0", SPAN[t.size])}>
              {frame(t)}
            </div>
          ))}
        </div>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={onDragStart} onDragEnd={onDragEnd} onDragCancel={() => setActiveId(null)}>
          <SortableContext items={ids} strategy={rectSortingStrategy}>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-12">
              {tiles.map((t) => (
                <SortableTile key={t.id} tile={t} ctx={ctx} editing={editing === t.id} onEditing={(on) => setEditing(on ? t.id : null)} refreshSignal={refreshSignal} />
              ))}
            </div>
          </SortableContext>
          <DragOverlay dropAnimation={{ duration: 240, easing: "cubic-bezier(0.2, 0, 0, 1)" }}>
            {active ? (
              <div className="scale-[1.015]">
                <TileFrame tile={active} ctx={ctx} overlay editing={false} onEditing={() => {}} refreshSignal={0} />
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      )}

      {/* the quiet end of the board */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-zinc-100 pt-4 dark:border-zinc-900">
        {/* a metric tile reads the stats API, no model's SQL */}
        {tiles.some((t) => t.kind === "chart") ? <p className="font-mono text-[10.5px] text-zinc-400 dark:text-zinc-500">Tiles run SQL written by an AI model; it may not be 100% accurate.</p> : <span />}
        {readOnly ? null : confirmDelete ? (
          <span className="flex items-center gap-3 font-mono text-[11px]">
            <span className="text-zinc-500">Delete this board?</span>
            <button
              type="button"
              onClick={() => {
                api.remove(board.id);
                router.push(boardsHref(props.network, props.chainSlug));
              }}
              className="font-bold uppercase tracking-[0.12em] text-[#E6212F]"
            >
              Delete
            </button>
            <button type="button" onClick={() => setConfirmDelete(false)} className="uppercase tracking-[0.12em] text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100">
              Keep
            </button>
          </span>
        ) : (
          <button
            type="button"
            onClick={() => setConfirmDelete(true)}
            className="flex items-center gap-1.5 font-mono text-[10.5px] uppercase tracking-[0.14em] text-zinc-400 transition-colors hover:text-[#E6212F] dark:text-zinc-500"
          >
            <Trash2 className="h-3.5 w-3.5" /> Delete board
          </button>
        )}
      </div>

      <QueryInspector
        open={sheetOpen}
        onClose={() => {
          drillRun.current++;
          setSheetOpen(false);
        }}
        title={level?.title ?? ""}
        sub={level?.sub}
        columns={level?.columns ?? []}
        rows={level?.rows ?? []}
        total={level?.rows.length ?? 0}
        names={level?.names ?? {}}
        visual={level?.visual ?? null}
        base={base}
        sym={props.sym}
        onOpen={level?.onOpen}
        busy={!!level?.busy}
        error={level?.error ?? null}
        sql={level?.busy ? undefined : level?.sql}
        onBack={
          sheet.length > 1
            ? () => {
                drillRun.current++;
                setSheet((s) => s.slice(0, -1));
              }
            : undefined
        }
        hint="Esc closes"
      />
    </div>
  );
}
