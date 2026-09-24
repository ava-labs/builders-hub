"use client";

/* Boards: a canvas of answers. Tiles sit on a 12-column grid (one
   column on a phone), drag by their grip to reorder, and take one of
   four widths. A chart tile draws at once from the rows it kept, then
   runs its SQL again behind the reader, two at a time. Notes carry the
   headings a dashboard needs. The board index, the canvas and the pin
   button all live here; the store is lib/explorer-query/board.ts. */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
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
import { SortableContext, arrayMove, rectSortingStrategy, sortableKeyboardCoordinates, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import * as Popover from "@radix-ui/react-popover";
import {
  ArrowUpRight,
  Check,
  Copy,
  CornerDownRight,
  GripVertical,
  LayoutGrid,
  Link2,
  MoreHorizontal,
  Pin,
  Plus,
  RotateCw,
  StickyNote,
  Trash2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useChainContext } from "@/app/(home)/explorer/[network]/[chain]/layout.client";
import {
  SIZE_LABEL,
  TILE_SIZES,
  askHref,
  boardHref,
  boardScope,
  boardsHref,
  encodeBoard,
  importBoard,
  nextSize,
  noteTile,
  pinAnswer,
  snapshotOf,
  sortedTiles,
  useBoards,
  useHydrated,
  type Board,
  type ChartTile,
  type NoteTile,
  type Tile,
  type TileSize,
} from "@/lib/explorer-query/board";
import type { QueryAnswer } from "@/lib/explorer-query/types";
import type { VisualSpec } from "@/lib/explorer-query/visual";
import { QueryVisual, fmt, nameFor } from "./QueryVisual";
import { BoardThumb, Label, NoteBody, QueryPageShell, ago, runTileSql, useNow } from "./query-board-bits";

type Row = Record<string, unknown>;
type Kind = "evm" | "pchain";

/** rows older than this are run again when the board opens */
const STALE_MS = 60_000;

/* spans per width: a phone stacks, a tablet pairs, a desk uses all 12 */
const SPAN: Record<TileSize, string> = {
  s: "md:col-span-6 xl:col-span-4",
  m: "md:col-span-6",
  l: "md:col-span-12 xl:col-span-8",
  w: "md:col-span-12",
};

const btn =
  "inline-flex items-center gap-1.5 rounded-full border border-zinc-200 bg-white px-3 py-1.5 font-mono text-[10.5px] font-bold uppercase tracking-[0.12em] text-zinc-600 transition-colors hover:border-zinc-900 hover:text-zinc-900 disabled:opacity-40 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-300 dark:hover:border-zinc-100 dark:hover:text-zinc-50";
const iconBtn =
  "inline-flex h-7 w-7 items-center justify-center rounded-full text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-900 disabled:opacity-40 dark:text-zinc-500 dark:hover:bg-zinc-900 dark:hover:text-zinc-100";

/* ------------------------------------------------------------------ */
/* a tile's chart                                                      */

/** the tile's slice of the answer: one panel alone, or all of it */
function tileVisual(t: ChartTile): VisualSpec {
  if (t.panelIndex === null) return t.visual;
  const p = t.visual.panels[t.panelIndex] ?? t.visual.panels[0];
  return { stats: [], callouts: [], panels: [{ ...p, width: "full", kind: t.view ?? p.kind }] };
}

const cell = (v: unknown, col: string, names: Record<string, Record<string, string>>, sym: string): string => {
  const name = nameFor(names, col, v);
  if (name) return name;
  if (typeof v === "number") return fmt(v, "number", sym);
  if (typeof v === "string" && /^0x[0-9a-fA-F]{40,}$/.test(v)) return `${v.slice(0, 8)}…${v.slice(-4)}`;
  return v === null || v === undefined ? "" : String(v);
};

function MiniTable({ columns, rows, names, sym }: { columns: { name: string }[]; rows: Row[]; names: Record<string, Record<string, string>>; sym: string }) {
  if (!rows.length) return <p className="py-6 text-center font-mono text-[12px] text-zinc-400">No rows</p>;
  return (
    <div className="max-h-80 overflow-auto rounded-lg border border-zinc-100 dark:border-zinc-900">
      <table className="w-full border-collapse text-left font-mono text-[11.5px] tabular-nums">
        <thead className="sticky top-0 bg-zinc-50 dark:bg-zinc-900">
          <tr>
            {columns.map((c) => (
              <th key={c.name} className="whitespace-nowrap px-2.5 py-1.5 text-[9.5px] font-bold uppercase tracking-[0.14em] text-zinc-500">
                {c.name.replace(/_/g, " ")}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.slice(0, 60).map((r, i) => (
            <tr key={i} className="border-t border-zinc-100 dark:border-zinc-900">
              {columns.map((c) => (
                <td key={c.name} className="max-w-[16rem] truncate whitespace-nowrap px-2.5 py-1.5 text-zinc-700 dark:text-zinc-300">
                  {cell(r[c.name], c.name, names, sym)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** the tile's rows drawn with the page's own charts; read-only */
export function TileChart({ tile, sym }: { tile: ChartTile; sym: string }) {
  const [range, setRange] = useState<[number, number] | null>(null);
  const visual = useMemo(() => tileVisual(tile), [tile]);
  const snap = tile.snapshot;
  if (!snap) {
    return (
      <div aria-busy="true" className="flex h-56 flex-col justify-end gap-2 pb-2">
        <span className="sr-only">Running the query</span>
        <div className="flex h-full items-end gap-2">
          {[40, 62, 48, 80, 58, 72, 50, 66].map((h, i) => (
            <span key={i} className="flex-1 animate-pulse rounded-sm bg-zinc-100 dark:bg-zinc-900" style={{ height: `${h}%`, animationDelay: `${i * 80}ms` }} />
          ))}
        </div>
      </div>
    );
  }
  const charts = visual.panels.filter((p) => p.kind !== "table" && p.x && p.series.length > 0);
  if (charts.length === 0) return <MiniTable columns={snap.columns} rows={snap.rows} names={snap.names} sym={sym} />;
  return (
    <QueryVisual
      visual={visual}
      rows={snap.rows}
      names={snap.names}
      sym={sym}
      canDrill={false}
      onPick={() => {}}
      range={range}
      onRange={setRange}
      onZoom={() => {}}
    />
  );
}

/* ------------------------------------------------------------------ */
/* inline text                                                         */

function InlineName({ value, onSave, className, placeholder }: { value: string; onSave: (v: string) => void; className?: string; placeholder?: string }) {
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);
  return (
    <input
      value={draft}
      placeholder={placeholder}
      aria-label={placeholder ?? "Name"}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => draft.trim() !== value && onSave(draft)}
      onKeyDown={(e) => {
        if (e.key === "Enter") (e.target as HTMLInputElement).blur();
        if (e.key === "Escape") {
          setDraft(value);
          (e.target as HTMLInputElement).blur();
        }
      }}
      className={cn(
        "min-w-0 rounded-md bg-transparent outline-none transition-colors placeholder:text-zinc-300 hover:bg-zinc-50 focus:bg-zinc-50 focus:ring-1 focus:ring-zinc-200 dark:placeholder:text-zinc-700 dark:hover:bg-zinc-900/60 dark:focus:bg-zinc-900/60 dark:focus:ring-zinc-800",
        className,
      )}
    />
  );
}

/* ------------------------------------------------------------------ */
/* one tile                                                            */

interface TileCtx {
  scope: string;
  boardId: string;
  chainId: number | string;
  network: string;
  chainSlug: string;
  sym: string;
  api: ReturnType<typeof useBoards>;
}

interface Handle {
  ref?: (el: HTMLElement | null) => void;
  props?: Record<string, unknown>;
}

function SizeHandle({ size, onSize }: { size: TileSize; onSize: (s: TileSize) => void }) {
  const next = nextSize(size);
  return (
    <button
      type="button"
      onClick={() => onSize(next)}
      title={`${SIZE_LABEL[size]}. Click for ${SIZE_LABEL[next].toLowerCase()}`}
      aria-label={`Resize tile to ${SIZE_LABEL[next].toLowerCase()}`}
      className="absolute bottom-1.5 right-1.5 hidden h-6 w-6 items-center justify-center rounded-md text-zinc-300 opacity-0 transition-opacity hover:text-zinc-900 focus-visible:opacity-100 group-hover/tile:opacity-100 md:flex dark:text-zinc-700 dark:hover:text-zinc-100"
    >
      <svg viewBox="0 0 12 12" className="h-3 w-3" aria-hidden>
        <path d="M11 4 L4 11 M11 8 L8 11" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      </svg>
    </button>
  );
}

function TileMenu({ tile, ctx, onRename, onEdit }: { tile: Tile; ctx: TileCtx; onRename?: () => void; onEdit?: () => void }) {
  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger className={iconBtn} aria-label="Tile options">
        <MoreHorizontal className="h-4 w-4" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48 font-mono text-[12px]">
        {tile.kind === "chart" && (
          <DropdownMenuItem asChild>
            <Link href={askHref(ctx.network, ctx.chainSlug, tile.question)}>
              <ArrowUpRight className="h-3.5 w-3.5" /> Open in Query
            </Link>
          </DropdownMenuItem>
        )}
        {onRename && <DropdownMenuItem onSelect={onRename}>Rename</DropdownMenuItem>}
        {onEdit && <DropdownMenuItem onSelect={onEdit}>Edit text</DropdownMenuItem>}
        <DropdownMenuItem onSelect={() => ctx.api.duplicateTile(ctx.boardId, tile.id)}>
          <Copy className="h-3.5 w-3.5" /> Duplicate
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuLabel className="text-[9.5px] font-bold uppercase tracking-[0.16em] text-zinc-400">Width</DropdownMenuLabel>
        <DropdownMenuRadioGroup value={tile.size} onValueChange={(v) => ctx.api.updateTile(ctx.boardId, tile.id, { size: v as TileSize })}>
          {TILE_SIZES.map((s) => (
            <DropdownMenuRadioItem key={s} value={s}>
              {SIZE_LABEL[s]}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => ctx.api.removeTile(ctx.boardId, tile.id)} className="text-[#E6212F] focus:text-[#E6212F]">
          <Trash2 className="h-3.5 w-3.5" /> Remove
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function Grip({ handle }: { handle?: Handle }) {
  return (
    <button
      type="button"
      ref={handle?.ref}
      {...handle?.props}
      aria-label="Drag to move"
      className="-ml-1.5 flex h-7 w-5 shrink-0 cursor-grab touch-none items-center justify-center rounded text-zinc-300 transition-colors hover:text-zinc-600 active:cursor-grabbing md:opacity-0 md:group-hover/tile:opacity-100 md:focus-visible:opacity-100 dark:text-zinc-700 dark:hover:text-zinc-300"
    >
      <GripVertical className="h-4 w-4" />
    </button>
  );
}

function ChartTileCard({ tile, ctx, handle, overlay, refreshSignal }: { tile: ChartTile; ctx: TileCtx; handle?: Handle; overlay?: boolean; refreshSignal: number }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [renaming, setRenaming] = useState(false);
  const now = useNow();
  const { scope, boardId, chainId, api } = ctx;

  const refresh = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const r = await runTileSql(`${scope}/${boardId}/${tile.id}`, chainId, tile.sql);
      api.updateTile(boardId, tile.id, { snapshot: snapshotOf(r.result, r.names, r.anchor) });
    } catch (e) {
      setError(e instanceof Error ? e.message : "The query failed");
    } finally {
      setBusy(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scope, boardId, tile.id, tile.sql, chainId]);

  // drawn from the kept rows first; stale rows run again behind the reader
  const at = tile.snapshot?.at;
  useEffect(() => {
    if (overlay) return;
    if (!at || Date.now() - at > STALE_MS) void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [overlay]);
  const firstSignal = useRef(refreshSignal);
  useEffect(() => {
    if (overlay || refreshSignal === firstSignal.current) return;
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshSignal]);

  return (
    <>
      <header className="flex items-center gap-1.5">
        <Grip handle={handle} />
        {renaming ? (
          <InlineName
            value={tile.title}
            placeholder="Tile title"
            onSave={(v) => {
              api.updateTile(boardId, tile.id, { title: v.trim().slice(0, 80) || tile.title });
              setRenaming(false);
            }}
            className="flex-1 px-1.5 py-0.5 text-[14.5px] font-medium tracking-tight text-zinc-900 dark:text-zinc-50"
          />
        ) : (
          <h3
            onDoubleClick={() => setRenaming(true)}
            title={tile.question}
            className="min-w-0 flex-1 truncate text-[14.5px] font-medium tracking-tight text-zinc-900 dark:text-zinc-50"
          >
            {tile.title || tile.question}
          </h3>
        )}
        <button type="button" onClick={() => void refresh()} disabled={busy} className={iconBtn} aria-label="Refresh">
          <RotateCw className={cn("h-3.5 w-3.5", busy && "animate-spin")} />
        </button>
        <TileMenu tile={tile} ctx={ctx} onRename={() => setRenaming(true)} />
      </header>
      <div className={cn("min-w-0 transition-opacity duration-300", busy && tile.snapshot && "opacity-60")}>
        <TileChart tile={tile} sym={ctx.sym} />
      </div>
      <footer className="flex items-center justify-between gap-3 pr-6 font-mono text-[10.5px] text-zinc-400 dark:text-zinc-500">
        {error ? (
          <span className="truncate text-[#E6212F]" title={error}>
            {error}
          </span>
        ) : (
          <span>{busy ? "Refreshing" : tile.snapshot ? `Refreshed ${ago(tile.snapshot.at, now)}` : "Waiting to run"}</span>
        )}
        <Link
          href={askHref(ctx.network, ctx.chainSlug, tile.question)}
          className="flex shrink-0 items-center gap-1 uppercase tracking-[0.14em] transition-colors hover:text-zinc-900 dark:hover:text-zinc-100"
        >
          Open <ArrowUpRight className="h-3 w-3" />
        </Link>
      </footer>
    </>
  );
}

function NoteTileCard({ tile, ctx, handle, editing, onEditing }: { tile: NoteTile; ctx: TileCtx; handle?: Handle; editing: boolean; onEditing: (on: boolean) => void }) {
  const [draft, setDraft] = useState(tile.text);
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => setDraft(tile.text), [tile.text]);
  useEffect(() => {
    if (!editing || !ref.current) return;
    ref.current.focus();
    ref.current.select();
  }, [editing]);
  const fit = (el: HTMLTextAreaElement | null) => {
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  };
  useEffect(() => fit(ref.current), [draft, editing]);
  const save = () => {
    if (draft !== tile.text) ctx.api.updateTile(ctx.boardId, tile.id, { text: draft.slice(0, 4000) });
    onEditing(false);
  };
  return (
    <div className="flex items-start gap-1.5">
      <Grip handle={handle} />
      <div className="min-w-0 flex-1 py-0.5">
        {editing ? (
          <>
            <textarea
              ref={ref}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onBlur={save}
              onKeyDown={(e) => {
                if (e.key === "Escape") {
                  setDraft(tile.text);
                  onEditing(false);
                }
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) save();
              }}
              rows={3}
              className="w-full resize-none rounded-lg bg-zinc-50 p-2.5 font-mono text-[13px] leading-relaxed text-zinc-800 outline-none ring-1 ring-zinc-200 dark:bg-zinc-900/70 dark:text-zinc-200 dark:ring-zinc-800"
            />
            <p className="mt-1.5 font-mono text-[10px] text-zinc-400 dark:text-zinc-500"># heading, ## subheading, - list, **bold**, `code`. Cmd+Enter to save.</p>
          </>
        ) : (
          <div onDoubleClick={() => onEditing(true)} className="cursor-text">
            {tile.text.trim() ? <NoteBody text={tile.text} /> : <p className="text-[14px] text-zinc-400">Empty note. Double-click to write.</p>}
          </div>
        )}
      </div>
      <TileMenu tile={tile} ctx={ctx} onEdit={() => onEditing(true)} />
    </div>
  );
}

function TileFrame({
  tile,
  ctx,
  handle,
  overlay,
  editing,
  onEditing,
  refreshSignal,
}: {
  tile: Tile;
  ctx: TileCtx;
  handle?: Handle;
  overlay?: boolean;
  editing: boolean;
  onEditing: (on: boolean) => void;
  refreshSignal: number;
}) {
  return (
    <motion.div
      layout={!overlay}
      layoutDependency={tile.size}
      transition={{ type: "spring", stiffness: 420, damping: 40 }}
      className={cn(
        "group/tile relative flex h-full min-w-0 flex-col gap-3 rounded-2xl p-4 transition-shadow duration-200",
        tile.kind === "note"
          ? "border border-transparent hover:border-zinc-200 dark:hover:border-zinc-800"
          : "border border-zinc-200 bg-white shadow-[0_1px_2px_rgba(24,24,27,0.04)] dark:border-zinc-800 dark:bg-zinc-950",
        overlay && "cursor-grabbing border-zinc-300 bg-white shadow-[0_24px_48px_-16px_rgba(24,24,27,0.35),0_4px_12px_-4px_rgba(24,24,27,0.12)] dark:border-zinc-700 dark:bg-zinc-950 dark:shadow-[0_24px_48px_-16px_rgba(0,0,0,0.8)]",
      )}
    >
      {tile.kind === "chart" ? (
        <ChartTileCard tile={tile} ctx={ctx} handle={handle} overlay={overlay} refreshSignal={refreshSignal} />
      ) : (
        <NoteTileCard tile={tile} ctx={ctx} handle={handle} editing={editing && !overlay} onEditing={onEditing} />
      )}
      {!overlay && <SizeHandle size={tile.size} onSize={(s) => ctx.api.updateTile(ctx.boardId, tile.id, { size: s })} />}
    </motion.div>
  );
}

function SortableTile(props: { tile: Tile; ctx: TileCtx; editing: boolean; onEditing: (on: boolean) => void; refreshSignal: number }) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id: props.tile.id });
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={cn("col-span-1 min-w-0", SPAN[props.tile.size], isDragging && "opacity-30")}
    >
      <TileFrame {...props} handle={{ ref: setActivatorNodeRef, props: { ...attributes, ...listeners } }} />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* the canvas                                                          */

interface BoardPageProps {
  network: string;
  chainSlug: string;
  chainId: number | string;
  kind: Kind;
  sym: string;
}

function useCopied(): [boolean, (text: string) => void] {
  const [done, setDone] = useState(false);
  return [
    done,
    (text) => {
      void navigator.clipboard?.writeText(text).then(() => {
        setDone(true);
        setTimeout(() => setDone(false), 1600);
      });
    },
  ];
}

function BoardCanvas({ board, props }: { board: Board; props: BoardPageProps }) {
  const scope = boardScope(props.network, props.chainSlug);
  const api = useBoards(scope);
  const router = useRouter();
  const now = useNow();
  const tiles = sortedTiles(board);
  const ids = tiles.map((t) => t.id);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [refreshSignal, setRefreshSignal] = useState(0);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [copied, copy] = useCopied();
  const ctx: TileCtx = { scope, boardId: board.id, chainId: props.chainId, network: props.network, chainSlug: props.chainSlug, sym: props.sym, api };

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
  const share = () => copy(`${window.location.origin}${boardsHref(props.network, props.chainSlug)}?board=${encodeBoard(board)}`);
  const charts = tiles.filter((t) => t.kind === "chart").length;

  return (
    <div className="flex flex-col gap-8 pt-4">
      {/* the board's header */}
      <header className="flex flex-col gap-4">
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
            <InlineName
              value={board.name}
              placeholder="Board name"
              onSave={(v) => api.rename(board.id, v)}
              className="-ml-2 w-full max-w-2xl px-2 py-0.5 text-[28px] font-semibold tracking-tight text-zinc-900 sm:text-[32px] dark:text-zinc-50"
            />
            <p className="font-mono text-[11px] text-zinc-400 dark:text-zinc-500">
              {tiles.length} {tiles.length === 1 ? "tile" : "tiles"} · updated {ago(board.updatedAt, now)} · kept on this device
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={addNote} className={btn}>
              <StickyNote className="h-3.5 w-3.5" /> Note
            </button>
            <button type="button" onClick={() => setRefreshSignal((n) => n + 1)} disabled={charts === 0} className={btn}>
              <RotateCw className="h-3.5 w-3.5" /> Refresh all
            </button>
            <button type="button" onClick={share} disabled={tiles.length === 0} className={btn}>
              {copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Link2 className="h-3.5 w-3.5" />} {copied ? "Link copied" : "Share"}
            </button>
            <Link
              href={askHref(props.network, props.chainSlug)}
              className="inline-flex items-center gap-1.5 rounded-full bg-zinc-900 px-3.5 py-1.5 font-mono text-[10.5px] font-bold uppercase tracking-[0.12em] text-zinc-50 transition-opacity hover:opacity-85 dark:bg-zinc-50 dark:text-zinc-900"
            >
              <Plus className="h-3.5 w-3.5" /> Ask
            </Link>
          </div>
        </div>
      </header>

      {tiles.length === 0 ? (
        <div className="flex flex-col items-center gap-5 rounded-3xl border border-dashed border-zinc-300 px-6 py-20 text-center dark:border-zinc-800">
          <div className="grid grid-cols-3 gap-1.5 opacity-60" aria-hidden>
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <span key={i} className={cn("h-5 rounded-[5px] border border-zinc-200 dark:border-zinc-800", i === 0 ? "col-span-2" : i === 3 ? "col-span-3" : "col-span-1")} />
            ))}
          </div>
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
      <div className="flex justify-end border-t border-zinc-100 pt-4 dark:border-zinc-900">
        {confirmDelete ? (
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
    </div>
  );
}

/** one board's canvas, from this device's store */
export function QueryBoardPage({ boardId, ...props }: BoardPageProps & { boardId: string }) {
  const hydrated = useHydrated();
  const { boards } = useBoards(boardScope(props.network, props.chainSlug));
  const board = boards.find((b) => b.id === boardId);
  return (
    <QueryPageShell kind={props.kind} network={props.network}>
      {!hydrated ? (
        <div className="h-96" aria-busy="true" />
      ) : board ? (
        <BoardCanvas board={board} props={props} />
      ) : (
        <div className="flex flex-col items-start gap-3 pt-10">
          <p className="text-[18px] font-medium tracking-tight text-zinc-900 dark:text-zinc-50">This board is not on this device</p>
          <p className="max-w-md text-[14px] text-zinc-500 dark:text-zinc-400">Boards are kept in this browser. To move one, open it where it was made and share its link.</p>
          <Link href={boardsHref(props.network, props.chainSlug)} className={btn}>
            <LayoutGrid className="h-3.5 w-3.5" /> All boards
          </Link>
        </div>
      )}
    </QueryPageShell>
  );
}

/* ------------------------------------------------------------------ */
/* the index                                                           */

/** a board as a card: its layout in miniature, its name, its age */
export function BoardCard({ board, href, now }: { board: Board; href: string; now: number }) {
  return (
    <Link
      href={href}
      className="group flex flex-col gap-3 rounded-2xl border border-zinc-200 bg-white p-3 transition-all duration-200 hover:-translate-y-0.5 hover:border-zinc-300 hover:shadow-[0_16px_32px_-18px_rgba(24,24,27,0.35)] dark:border-zinc-800 dark:bg-zinc-950 dark:hover:border-zinc-700"
    >
      <div className="h-28 overflow-hidden rounded-xl bg-zinc-50 p-2.5 dark:bg-zinc-900/50">
        <BoardThumb board={board} />
      </div>
      <div className="flex items-end justify-between gap-3 px-1 pb-0.5">
        <div className="flex min-w-0 flex-col gap-0.5">
          <span className="truncate text-[14.5px] font-medium tracking-tight text-zinc-900 dark:text-zinc-50">{board.name}</span>
          <span className="font-mono text-[10.5px] text-zinc-400 dark:text-zinc-500">
            {board.tiles.length} {board.tiles.length === 1 ? "tile" : "tiles"} · {ago(board.updatedAt, now)}
          </span>
        </div>
        <ArrowUpRight className="h-4 w-4 shrink-0 text-zinc-300 transition-all group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-zinc-900 dark:text-zinc-700 dark:group-hover:text-zinc-100" />
      </div>
    </Link>
  );
}

/** the "new board" card: makes one and opens it */
export function NewBoardCard({ network, chainSlug, className }: { network: string; chainSlug: string; className?: string }) {
  const router = useRouter();
  const { create } = useBoards(boardScope(network, chainSlug));
  return (
    <button
      type="button"
      onClick={() => router.push(boardHref(network, chainSlug, create().id))}
      className={cn(
        "flex min-h-[11.5rem] flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-zinc-300 text-zinc-400 transition-colors hover:border-zinc-900 hover:text-zinc-900 dark:border-zinc-800 dark:text-zinc-500 dark:hover:border-zinc-100 dark:hover:text-zinc-100",
        className,
      )}
    >
      <Plus className="h-5 w-5" />
      <span className="font-mono text-[10.5px] font-bold uppercase tracking-[0.14em]">New board</span>
    </button>
  );
}

/** every board on this chain; a ?board= link is kept as a new one and opened */
export function QueryBoardsPage({ network, chainSlug, kind }: { network: string; chainSlug: string; kind: Kind }) {
  const hydrated = useHydrated();
  const scope = boardScope(network, chainSlug);
  const { boards } = useBoards(scope);
  const now = useNow();
  const router = useRouter();
  const shared = useSearchParams().get("board");
  const [bad, setBad] = useState(false);
  const imported = useRef(false);
  useEffect(() => {
    if (!shared || imported.current) return;
    imported.current = true;
    const b = importBoard(scope, shared);
    if (b) router.replace(boardHref(network, chainSlug, b.id));
    else setBad(true);
  }, [shared, scope, network, chainSlug, router]);

  return (
    <QueryPageShell kind={kind} network={network}>
      <div className="flex flex-col gap-8 pt-4">
        <header className="flex flex-col gap-4">
          <nav aria-label="Breadcrumb" className="flex items-center gap-2 font-mono text-[10.5px] uppercase tracking-[0.14em] text-zinc-400 dark:text-zinc-500">
            <Link href={askHref(network, chainSlug)} className="transition-colors hover:text-zinc-900 dark:hover:text-zinc-100">
              Query
            </Link>
            <span className="text-zinc-300 dark:text-zinc-700">/</span>
            <span className="text-zinc-600 dark:text-zinc-300">Boards</span>
          </nav>
          <div className="flex flex-col gap-1.5">
            <h1 className="text-[28px] font-semibold tracking-tight text-zinc-900 sm:text-[32px] dark:text-zinc-50">Boards</h1>
            <p className="max-w-xl text-[14px] leading-relaxed text-zinc-500 dark:text-zinc-400">
              Pages of charts built from your answers. Each chart keeps its SQL and runs again when you open the board. Kept on this device.
            </p>
          </div>
          {bad && <p className="border-l-2 border-[#E6212F] pl-3 font-mono text-[12px] text-[#E6212F]">That board link could not be read.</p>}
        </header>
        {hydrated && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            <NewBoardCard network={network} chainSlug={chainSlug} />
            {boards.map((b) => (
              <BoardCard key={b.id} board={b} href={boardHref(network, chainSlug, b.id)} now={now} />
            ))}
          </div>
        )}
      </div>
    </QueryPageShell>
  );
}

/* ------------------------------------------------------------------ */
/* page entry points                                                   */

export function EvmQueryBoards({ network }: { network: string }) {
  const c = useChainContext();
  return <QueryBoardsPage network={network} chainSlug={c.chainSlug} kind="evm" />;
}

export function EvmQueryBoard({ network, id }: { network: string; id: string }) {
  const c = useChainContext();
  return <QueryBoardPage network={network} chainSlug={c.chainSlug} chainId={c.chainId} kind="evm" sym={c.nativeToken ?? "AVAX"} boardId={id} />;
}

export function PchainQueryBoards({ network }: { network: string }) {
  return <QueryBoardsPage network={network} chainSlug="p-chain" kind="pchain" />;
}

export function PchainQueryBoard({ network, id }: { network: string; id: string }) {
  return <QueryBoardPage network={network} chainSlug="p-chain" chainId={network === "fuji" ? 5 : 1} kind="pchain" sym="AVAX" boardId={id} />;
}

/* ------------------------------------------------------------------ */
/* pinning                                                             */

/** pin an answer, or one of its panels, to a board: pick one or make one */
export function PinToBoard({
  chain,
  network,
  answer,
  panelIndex,
  question,
  className,
}: {
  /** the chain slug: "c-chain", "p-chain" */
  chain: string;
  network: string;
  answer: QueryAnswer;
  /** one panel of the answer; omit to pin the whole answer with its figures */
  panelIndex?: number;
  /** the question as asked, so Open asks it again; defaults to the title */
  question?: string;
  className?: string;
}) {
  const { boards, create, addTile } = useBoards(boardScope(network, chain));
  const [open, setOpen] = useState(false);
  const [naming, setNaming] = useState(false);
  const [name, setName] = useState("");
  const [done, setDone] = useState<{ id: string; name: string } | null>(null);
  const tile = useMemo(() => pinAnswer(answer, { panelIndex, question }), [answer, panelIndex, question]);

  const pinTo = (b: Board) => {
    if (!tile) return;
    addTile(b.id, tile);
    setDone({ id: b.id, name: b.name });
  };
  const pinNew = () => {
    if (!tile) return;
    const b = create(name.trim() || answer.title.slice(0, 60) || "Untitled board", [tile]);
    setDone({ id: b.id, name: b.name });
  };

  return (
    <Popover.Root
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) {
          setDone(null);
          setNaming(false);
          setName("");
        }
      }}
    >
      <Popover.Trigger
        disabled={!tile}
        aria-label={panelIndex === undefined ? "Pin this answer to a board" : "Pin this chart to a board"}
        className={cn(
          "inline-flex items-center gap-1.5 rounded-full px-2 py-1 font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-900 disabled:opacity-40 data-[state=open]:bg-zinc-100 data-[state=open]:text-zinc-900 dark:text-zinc-500 dark:hover:bg-zinc-900 dark:hover:text-zinc-100 dark:data-[state=open]:bg-zinc-900 dark:data-[state=open]:text-zinc-100",
          className,
        )}
      >
        <Pin className="h-3 w-3" /> Pin
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="end"
          sideOffset={6}
          className="z-50 w-72 overflow-hidden rounded-2xl border border-zinc-200 bg-white/95 p-1.5 shadow-[0_24px_48px_-20px_rgba(24,24,27,0.4)] backdrop-blur-xl data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 dark:border-zinc-800 dark:bg-zinc-950/95"
        >
          {done ? (
            <div className="flex flex-col gap-3 p-3">
              <span className="flex items-center gap-2 text-[14px] text-zinc-900 dark:text-zinc-50">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
                  <Check className="h-3 w-3" strokeWidth={3} />
                </span>
                <span className="min-w-0 truncate">
                  Pinned to <span className="font-medium">{done.name}</span>
                </span>
              </span>
              <Link
                href={boardHref(network, chain, done.id)}
                onClick={() => setOpen(false)}
                className="inline-flex items-center justify-center gap-1.5 rounded-full bg-zinc-900 px-3 py-2 font-mono text-[10.5px] font-bold uppercase tracking-[0.12em] text-zinc-50 transition-opacity hover:opacity-85 dark:bg-zinc-50 dark:text-zinc-900"
              >
                View board <ArrowUpRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          ) : (
            <div className="flex flex-col">
              <Label className="px-2.5 pb-1.5 pt-2">Pin to a board</Label>
              <div className="flex max-h-64 flex-col overflow-y-auto">
                {boards.map((b) => (
                  <button
                    key={b.id}
                    type="button"
                    onClick={() => pinTo(b)}
                    className="group flex items-center gap-3 rounded-xl px-2.5 py-2 text-left transition-colors hover:bg-zinc-100 dark:hover:bg-zinc-900"
                  >
                    <span className="h-8 w-12 shrink-0 overflow-hidden rounded-md bg-zinc-50 p-1 dark:bg-zinc-900">
                      <BoardThumb board={b} className="auto-rows-[0.35rem] gap-[2px]" />
                    </span>
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="truncate text-[13.5px] text-zinc-900 dark:text-zinc-50">{b.name}</span>
                      <span className="font-mono text-[10px] text-zinc-400">
                        {b.tiles.length} {b.tiles.length === 1 ? "tile" : "tiles"}
                      </span>
                    </span>
                    <Plus className="h-3.5 w-3.5 text-zinc-300 transition-colors group-hover:text-zinc-900 dark:text-zinc-700 dark:group-hover:text-zinc-100" />
                  </button>
                ))}
              </div>
              {boards.length > 0 && <div className="mx-2 my-1 h-px bg-zinc-100 dark:bg-zinc-900" />}
              {naming ? (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    pinNew();
                  }}
                  className="flex items-center gap-2 p-1.5"
                >
                  <input
                    autoFocus
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder={answer.title.slice(0, 60) || "Board name"}
                    className="min-w-0 flex-1 rounded-lg bg-zinc-50 px-2.5 py-1.5 text-[13.5px] text-zinc-900 outline-none ring-1 ring-zinc-200 placeholder:text-zinc-400 focus:ring-zinc-400 dark:bg-zinc-900 dark:text-zinc-50 dark:ring-zinc-800"
                  />
                  <button type="submit" className="rounded-lg bg-zinc-900 px-2.5 py-1.5 font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-zinc-50 dark:bg-zinc-50 dark:text-zinc-900">
                    Create
                  </button>
                </form>
              ) : (
                <button
                  type="button"
                  onClick={() => setNaming(true)}
                  className="flex items-center gap-3 rounded-xl px-2.5 py-2 text-left text-[13.5px] text-zinc-600 transition-colors hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-900 dark:hover:text-zinc-50"
                >
                  <span className="flex h-8 w-12 shrink-0 items-center justify-center rounded-md border border-dashed border-zinc-300 dark:border-zinc-700">
                    <CornerDownRight className="h-3.5 w-3.5" />
                  </span>
                  New board
                </button>
              )}
            </div>
          )}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
