"use client";

/* The three tiles a board holds: a chart of an answer's rows, a chart of
   the stats API's daily series, and a note. */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ArrowUpRight, RotateCw, Rows3 } from "lucide-react";
import { cn } from "@/lib/utils";
import { askHref, metricSnapshot, snapshotOf, type ChartTile, type MetricTile, type NoteTile, type Snapshot } from "@/lib/explorer-query/board";
import { loadMetricTile, metricChains, metricColumns, metricTitle, metricVisual, seriesLabels, windowRows, windowText } from "@/lib/explorer-query/stats-metrics";
import { formatNumber } from "@/components/explorer-v2/format";
import { QueryVisual } from "@/components/explorer-v2/evm/QueryVisual";
import { NoteBody, ago, runTileSql, useNow } from "@/components/explorer-v2/evm/query-board-bits";
import { InlineName, iconBtn, type Handle, type Row, type TileCtx } from "./parts";
import { TileChart } from "./tile-chart";
import { downloadTileCsv, downloadTilePng } from "./tile-export";
import { Grip, TileMenu } from "./tile-menu";

/** rows older than this are run again when the board opens */
const STALE_MS = 60_000;

/** the question and its follow-ups, as the tile's title tip reads them */
const threadOf = (t: ChartTile) => [t.question, ...(t.then ?? [])].map((q) => q.split("\n\n")[0]).join(" / ");

export function ChartTileCard({ tile, ctx, handle, overlay, refreshSignal }: { tile: ChartTile; ctx: TileCtx; handle?: Handle; overlay?: boolean; refreshSignal: number }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [renaming, setRenaming] = useState(false);
  const now = useNow();
  const { scope, boardId, chainId, api, readOnly } = ctx;
  const rows = tile.snapshot?.rows.length ?? 0;
  const head = useRef<HTMLDivElement>(null);
  const name = tile.title || tile.question;
  const snap = tile.snapshot;

  const refresh = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const r = await runTileSql(`${scope}/${boardId}/${tile.id}`, chainId, tile.sql);
      api.updateTile(boardId, tile.id, { snapshot: snapshotOf(r.result, r.names, r.anchor, { sql: tile.sql, totals: r.totals }) });
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
      <div ref={head} className="flex items-center gap-1.5">
        {!readOnly && <Grip handle={handle} />}
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
            onDoubleClick={readOnly ? undefined : () => setRenaming(true)}
            title={threadOf(tile)}
            className="min-w-0 flex-1 truncate text-[14.5px] font-medium tracking-tight text-zinc-900 dark:text-zinc-50"
          >
            {name}
          </h3>
        )}
        {rows > 0 && (
          <button type="button" data-no-shot onClick={() => ctx.onRows(tile)} className={iconBtn} aria-label={`Rows (${rows})`} title={`Rows (${formatNumber(rows)})`}>
            <Rows3 className="h-3.5 w-3.5" />
          </button>
        )}
        <button type="button" data-no-shot onClick={() => void refresh()} disabled={busy} className={iconBtn} aria-label="Refresh">
          <RotateCw className={cn("h-3.5 w-3.5", busy && "animate-spin")} />
        </button>
        {!readOnly && (
          <TileMenu
            tile={tile}
            ctx={ctx}
            onRename={() => setRenaming(true)}
            // one panel hands out its own columns; a whole answer or its figures, every column
            onCsv={snap ? () => downloadTileCsv(name, snap, tile.figures || tile.panelIndex === null ? undefined : tile.visual.panels[tile.panelIndex]) : undefined}
            onPng={snap ? () => void downloadTilePng(head.current, name) : undefined}
          />
        )}
      </div>
      <div className={cn("min-w-0 transition-opacity duration-300", busy && tile.snapshot && "opacity-60")}>
        <TileChart
          tile={tile}
          sym={ctx.sym}
          base={ctx.base}
          onMark={overlay ? undefined : (r) => ctx.onMark(tile, r)}
          onDrill={overlay ? undefined : (r) => ctx.onDrill(tile, r)}
          onRows={() => ctx.onRows(tile)}
        />
      </div>
      <footer data-no-shot className="flex items-center justify-between gap-3 pr-6 font-mono text-[10.5px] text-zinc-400 dark:text-zinc-500">
        {error ? (
          <span className="truncate text-[#E6212F]" title={error}>
            {error}
          </span>
        ) : (
          <span>{busy ? "Refreshing" : tile.snapshot ? `Refreshed ${ago(tile.snapshot.at, now)}` : "Waiting to run"}</span>
        )}
        <Link
          href={askHref(ctx.network, ctx.chainSlug, tile.question, tile.then)}
          className="flex shrink-0 items-center gap-1 uppercase tracking-[0.14em] transition-colors hover:text-zinc-900 dark:hover:text-zinc-100"
        >
          Open <ArrowUpRight className="h-3 w-3" />
        </Link>
      </footer>
    </>
  );
}

/* A metric tile (stats-metrics.ts): the stats API's days, not a query.
   It draws at once from the days it kept, reads every day the API has
   behind the reader (one read per chain and metric, kept by the route
   and the browser for hours), and its window picks the days it shows. */
export function MetricTileCard({ tile, ctx, handle, overlay, refreshSignal }: { tile: MetricTile; ctx: TileCtx; handle?: Handle; overlay?: boolean; refreshSignal: number }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [renaming, setRenaming] = useState(false);
  // every day the API has of the tile's series, keyed by the series
  const [all, setAll] = useState<{ key: string; rows: Row[]; at: number } | null>(null);
  const now = useNow();
  const { boardId, api, readOnly } = ctx;
  const key = JSON.stringify(tile.series);
  const win = `${tile.days ?? ""}|${tile.from ?? ""}|${tile.to ?? ""}`;
  // held across the store's other writes, so the charts keep their layout
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const visual = useMemo(() => metricVisual(tile), [key, tile.stacked]);

  const load = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      setAll({ key, rows: await loadMetricTile(tile), at: Date.now() });
    } catch (e) {
      setError(e instanceof Error ? e.message : "The stats API did not answer");
    } finally {
      setBusy(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  useEffect(() => {
    if (!overlay) void load();
  }, [overlay, load]);
  const firstSignal = useRef(refreshSignal);
  useEffect(() => {
    if (overlay || refreshSignal === firstSignal.current) return;
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshSignal]);

  // the window's days are kept for the next first paint; fresh rows are not an edit
  useEffect(() => {
    if (overlay || !all || all.key !== key) return;
    api.updateTile(boardId, tile.id, { snapshot: metricSnapshot(tile, windowRows(all.rows, tile)) });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [all, win]);

  const fresh = all?.key === key;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const rows = useMemo(() => (fresh ? windowRows(all.rows, tile) : (tile.snapshot?.rows ?? null)), [fresh, all, win, tile.snapshot]);
  const at = fresh ? all.at : tile.snapshot?.at;
  const snap: Snapshot | null = rows ? { columns: metricColumns(seriesLabels(tile.series)), rows, names: {}, at: at ?? Date.now() } : null;
  const chains = metricChains(tile);
  const head = useRef<HTMLDivElement>(null);
  // the window rides in the file's name, as it does in the sheet's title
  const name = `${metricTitle(tile)} ${windowText(tile)}`;

  return (
    <>
      <div ref={head} className="flex items-center gap-1.5">
        {!readOnly && <Grip handle={handle} />}
        {renaming ? (
          <InlineName
            value={metricTitle(tile)}
            placeholder="Tile title"
            onSave={(v) => {
              api.updateTile(boardId, tile.id, { title: v.trim().slice(0, 80) || tile.title });
              setRenaming(false);
            }}
            className="flex-1 px-1.5 py-0.5 text-[14.5px] font-medium tracking-tight text-zinc-900 dark:text-zinc-50"
          />
        ) : (
          <h3
            onDoubleClick={readOnly ? undefined : () => setRenaming(true)}
            className="min-w-0 flex-1 truncate text-[14.5px] font-medium tracking-tight text-zinc-900 dark:text-zinc-50"
          >
            {metricTitle(tile)}
          </h3>
        )}
        {!!rows?.length && (
          <button type="button" data-no-shot onClick={() => ctx.onRows(tile, snap)} className={iconBtn} aria-label={`Rows (${rows.length})`} title={`Rows (${formatNumber(rows.length)})`}>
            <Rows3 className="h-3.5 w-3.5" />
          </button>
        )}
        <button type="button" data-no-shot onClick={() => void load()} disabled={busy} className={iconBtn} aria-label="Refresh">
          <RotateCw className={cn("h-3.5 w-3.5", busy && "animate-spin")} />
        </button>
        {!readOnly && (
          <TileMenu
            tile={tile}
            ctx={ctx}
            onRename={() => setRenaming(true)}
            onCsv={snap?.rows.length ? () => downloadTileCsv(name, snap) : undefined}
            onPng={snap?.rows.length ? () => void downloadTilePng(head.current, name) : undefined}
          />
        )}
      </div>
      <div className={cn("min-w-0 transition-opacity duration-300", busy && rows && "opacity-60")}>
        {!rows && error && !busy ? (
          <p className="flex h-56 items-center justify-center px-6 text-center font-mono text-[11px] text-zinc-400 dark:text-zinc-500">{error}</p>
        ) : !rows ? (
          <div aria-busy="true" className="flex h-56 flex-col justify-end gap-2 pb-2">
            <span className="sr-only">Reading the stats API</span>
            <div className="flex h-full items-end gap-2">
              {[40, 62, 48, 80, 58, 72, 50, 66].map((h, i) => (
                <span key={i} className="flex-1 animate-pulse rounded-sm bg-zinc-100 dark:bg-zinc-900" style={{ height: `${h}%`, animationDelay: `${i * 80}ms` }} />
              ))}
            </div>
          </div>
        ) : rows.length === 0 ? (
          <p className="flex h-56 items-center justify-center font-mono text-[11px] text-zinc-400 dark:text-zinc-500">No days in this window</p>
        ) : (
          <QueryVisual visual={visual} rows={rows} names={{}} sym={ctx.sym} canDrill={false} onPick={() => {}} base={ctx.base} titles={false} cards={false} />
        )}
      </div>
      <footer data-no-shot className="flex items-center justify-between gap-3 pr-6 font-mono text-[10.5px] text-zinc-400 dark:text-zinc-500">
        {/* with no rows the error stands in the body */}
        {error && !rows ? (
          <span />
        ) : error ? (
          <span className="truncate text-[#E6212F]" title={error}>
            {error}
          </span>
        ) : (
          <span>{busy && !rows ? "Reading the stats API" : busy ? "Refreshing" : at ? `Refreshed ${ago(at, now)}` : "Waiting to read"}</span>
        )}
        <span className="shrink-0 truncate uppercase tracking-[0.14em]">
          {chains ? `${chains} · ` : ""}
          {windowText(tile)}
        </span>
      </footer>
    </>
  );
}

export function NoteTileCard({ tile, ctx, handle, editing, onEditing }: { tile: NoteTile; ctx: TileCtx; handle?: Handle; editing: boolean; onEditing: (on: boolean) => void }) {
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
      {!ctx.readOnly && <Grip handle={handle} />}
      <div className="min-w-0 flex-1 py-0.5">
        {editing && !ctx.readOnly ? (
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
          <div onDoubleClick={ctx.readOnly ? undefined : () => onEditing(true)} className={ctx.readOnly ? undefined : "cursor-text"}>
            {tile.text.trim() ? <NoteBody text={tile.text} /> : !ctx.readOnly && <p className="text-[14px] text-zinc-400">Empty note. Double-click to write.</p>}
          </div>
        )}
      </div>
      {!ctx.readOnly && <TileMenu tile={tile} ctx={ctx} onEdit={() => onEditing(true)} />}
    </div>
  );
}
