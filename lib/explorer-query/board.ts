/* Boards: pages a reader builds from answers. A tile keeps the question,
   the SQL and the layout the designer chose, so it can run again without
   a model; its last rows ride along as a snapshot, so a board opens drawn
   and refreshes behind the reader. The device keeps every board, per
   chain and network (a board's SQL names one chain_id); a signed-in
   reader's boards also sync to the account (board-sync.ts), and a board
   the account keeps opens for anyone with its link (board-shared.ts). */

import { useSyncExternalStore } from "react";
import type { ColumnMeta } from "./clickhouse";
import type { Drill, Names, QueryAnswer } from "./types";
import type { Panel, VisualSpec } from "./visual";
import { useBoardSync } from "./board-sync";
// the gate lives with the targets, so a server page can read it too
export { queryTarget } from "./target";

const KEY = "explorer-query-boards:v1";
/** deleted board ids and when, per scope, until the account has the delete */
const GONE_KEY = "explorer-query-boards:gone:v1";
/** old id -> new id, for a board whose id another account turned out to hold */
const MOVED_KEY = "explorer-query-boards:moved:v1";
const EVENT = "explorer-query-boards";
/** rows kept per snapshot; enough to draw any panel, small enough to store */
export const SNAPSHOT_ROWS = 500;

type Row = Record<string, unknown>;

/** grid spans on a 12-column canvas: a third, a half, two thirds, the width */
export type TileSize = "s" | "m" | "l" | "w";
export const TILE_SIZES: TileSize[] = ["s", "m", "l", "w"];
export const SIZE_SPAN: Record<TileSize, number> = { s: 4, m: 6, l: 8, w: 12 };
export const SIZE_LABEL: Record<TileSize, string> = { s: "Small", m: "Half", l: "Large", w: "Full width" };

export interface Snapshot {
  columns: ColumnMeta[];
  rows: Row[];
  names: Names;
  /** unix ms the rows were read */
  at: number;
  anchor?: string | null;
}

export interface ChartTile {
  kind: "chart";
  id: string;
  question: string;
  title: string;
  sql: string;
  visual: VisualSpec;
  /** one panel of the answer, or null for the whole answer with its figures */
  panelIndex: number | null;
  /** the reader's choice of chart for the panel, over the designer's */
  view?: Panel["kind"];
  /** the follow-ups asked after the question, in order */
  then?: string[];
  /** how a mark opens into the records behind it */
  drill?: Drill | null;
  size: TileSize;
  order: number;
  snapshot?: Snapshot;
}

/** a heading or a paragraph between charts, in a markdown-lite */
export interface NoteTile {
  kind: "note";
  id: string;
  text: string;
  size: TileSize;
  order: number;
}

export type Tile = ChartTile | NoteTile;

export interface Board {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  tiles: Tile[];
}

// the paths live apart from the store, so a server page can build them too
export { askHref, boardHref, boardScope, boardsHref } from "./board-links";

/* ------------------------------------------------------------------ */
/* the store                                                           */

type Store = Record<string, Board[]>;

function uid(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID().replace(/-/g, "").slice(0, 12);
  return Math.random().toString(36).slice(2, 14);
}

function readRaw(): string | null {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

function parse(raw: string | null): Store {
  if (!raw) return {};
  try {
    const s = JSON.parse(raw) as unknown;
    return s && typeof s === "object" ? (s as Store) : {};
  } catch {
    return {};
  }
}

/* a full store is written again lighter: shorter snapshots, then none,
   so the layout survives even when the rows cannot */
function write(store: Store): void {
  const attempts: ((t: Tile) => Tile)[] = [
    (t) => t,
    (t) => (t.kind === "chart" && t.snapshot ? { ...t, snapshot: { ...t.snapshot, rows: t.snapshot.rows.slice(0, 100) } } : t),
    (t) => (t.kind === "chart" ? { ...t, snapshot: undefined } : t),
  ];
  for (const shrink of attempts) {
    const next: Store = Object.fromEntries(Object.entries(store).map(([k, bs]) => [k, bs.map((b) => ({ ...b, tiles: b.tiles.map(shrink) }))]));
    try {
      localStorage.setItem(KEY, JSON.stringify(next));
      window.dispatchEvent(new Event(EVENT));
      return;
    } catch {
      /* over quota: try lighter */
    }
  }
}

function mutate(scope: string, fn: (boards: Board[]) => Board[]): void {
  const store = parse(readRaw());
  store[scope] = fn(store[scope] ?? []);
  write(store);
}

function touch(scope: string, id: string, fn: (b: Board) => Board): void {
  mutate(scope, (bs) => bs.map((b) => (b.id === id ? { ...fn(b), updatedAt: Date.now() } : b)));
}

const byOrder = (a: Tile, b: Tile) => a.order - b.order;

export function listBoards(scope: string): Board[] {
  return (parse(readRaw())[scope] ?? []).slice().sort((a, b) => b.updatedAt - a.updatedAt);
}

export function getBoard(scope: string, id: string): Board | undefined {
  return (parse(readRaw())[scope] ?? []).find((b) => b.id === id);
}

export function createBoard(scope: string, name = "Untitled board", tiles: Tile[] = []): Board {
  const now = Date.now();
  const board: Board = { id: uid(), name, createdAt: now, updatedAt: now, tiles: tiles.map((t, i) => ({ ...t, id: uid(), order: i })) };
  mutate(scope, (bs) => [...bs, board]);
  return board;
}

export function renameBoard(scope: string, id: string, name: string): void {
  touch(scope, id, (b) => ({ ...b, name: name.trim().slice(0, 80) || "Untitled board" }));
}

export function deleteBoard(scope: string, id: string): void {
  const gone = readGone();
  gone[scope] = { ...(gone[scope] ?? {}), [id]: Date.now() };
  writeGone(gone);
  mutate(scope, (bs) => bs.filter((b) => b.id !== id));
}

function readMoved(): Record<string, string> {
  try {
    const m = JSON.parse(localStorage.getItem(MOVED_KEY) ?? "{}") as unknown;
    return m && typeof m === "object" ? (m as Record<string, string>) : {};
  } catch {
    return {};
  }
}

/** where a board went when its id had to change; undefined when it never moved */
export function movedBoard(id: string): string | undefined {
  return readMoved()[id];
}

/* the account refused this id because another account holds it: the
   board takes a new one (its link changes with it), and the old id
   points to the new, so an open page follows. The store change sends it. */
export function reidBoard(scope: string, id: string): Board | null {
  const store = parse(readRaw());
  const b = (store[scope] ?? []).find((x) => x.id === id);
  if (!b) return null;
  const next: Board = { ...b, id: uid(), updatedAt: Date.now() };
  try {
    localStorage.setItem(MOVED_KEY, JSON.stringify({ ...readMoved(), [id]: next.id }));
  } catch {
    /* the page falls back to the board list */
  }
  store[scope] = (store[scope] ?? []).map((x) => (x.id === id ? next : x));
  write(store);
  return next;
}

/* ------------------------------------------------------------------ */
/* tombstones and the account's copy                                   */

type Gone = Record<string, Record<string, number>>;

function readGone(): Gone {
  try {
    const g = JSON.parse(localStorage.getItem(GONE_KEY) ?? "{}") as unknown;
    return g && typeof g === "object" ? (g as Gone) : {};
  } catch {
    return {};
  }
}

function writeGone(g: Gone): void {
  try {
    localStorage.setItem(GONE_KEY, JSON.stringify(g));
  } catch {
    /* a lost tombstone only means the board comes back */
  }
}

/** boards this device deleted, and when */
export function goneBoards(scope: string): Record<string, number> {
  return readGone()[scope] ?? {};
}

export function forgetGone(scope: string, ids: string[]): void {
  const g = readGone();
  if (!g[scope]) return;
  for (const id of ids) delete g[scope][id];
  writeGone(g);
}

/** the account's copy of a board, as this device receives it */
export interface RemoteBoard {
  id: string;
  name: string;
  tiles: unknown[];
  createdAt: number;
  updatedAt: number;
  deletedAt: number | null;
}

/** what a merge leaves for the device to send */
export interface MergeOut {
  put: Board[];
  del: { id: string; at: number }[];
}

/* the newer edit wins, board by board. The account's copy carries no
   rows, so a board taken from it keeps this device's snapshots for the
   tiles both copies share. `complete` means remote is every board the
   account has for the scope, so a board only here is new and goes up. */
export function mergeRemote(scope: string, remote: RemoteBoard[], complete: boolean): MergeOut {
  const store = parse(readRaw());
  const local = new Map((store[scope] ?? []).map((b) => [b.id, b]));
  const gone = goneBoards(scope);
  const out: MergeOut = { put: [], del: [] };
  const settled: string[] = [];
  for (const r of remote) {
    const l = local.get(r.id);
    if (r.deletedAt !== null) {
      if (l && l.updatedAt > r.deletedAt) out.put.push(l);
      else local.delete(r.id);
      settled.push(r.id);
      continue;
    }
    const at = gone[r.id];
    if (at !== undefined) {
      if (at >= r.updatedAt) {
        out.del.push({ id: r.id, at });
        continue;
      }
      // edited on another device after this one deleted it: it comes back
      settled.push(r.id);
    }
    if (l && l.updatedAt > r.updatedAt) {
      out.put.push(l);
      continue;
    }
    if (l && l.updatedAt === r.updatedAt) continue;
    const kept = new Map((l?.tiles ?? []).map((t) => [t.id, t]));
    const tiles = (r.tiles as Tile[]).map(normalTile).map((t) => {
      const old = kept.get(t.id);
      return t.kind === "chart" && old?.kind === "chart" && old.snapshot && old.sql === t.sql ? { ...t, snapshot: old.snapshot } : t;
    });
    local.set(r.id, { id: r.id, name: r.name, createdAt: r.createdAt, updatedAt: r.updatedAt, tiles });
  }
  if (complete) {
    const known = new Set(remote.map((r) => r.id));
    for (const b of local.values()) if (!known.has(b.id)) out.put.push(b);
    // a delete of a board the account never had needs no sending
    for (const id of Object.keys(gone)) if (!known.has(id)) settled.push(id);
  }
  forgetGone(scope, settled);
  store[scope] = [...local.values()];
  write(store);
  return out;
}

/** a tile goes to the end of the board */
export function addTile(scope: string, boardId: string, tile: Tile): Tile {
  const placed = { ...tile, id: uid() };
  touch(scope, boardId, (b) => ({ ...b, tiles: [...b.tiles, { ...placed, order: b.tiles.length ? Math.max(...b.tiles.map((t) => t.order)) + 1 : 0 }] }));
  return placed;
}

export function updateTile(scope: string, boardId: string, tileId: string, patch: Partial<ChartTile> | Partial<NoteTile>): void {
  const apply = (b: Board): Board => ({ ...b, tiles: b.tiles.map((t) => (t.id === tileId ? ({ ...t, ...patch, id: t.id, kind: t.kind } as Tile) : t)) });
  // fresh rows are not an edit: the board keeps its time, and the account is not written
  if (Object.keys(patch).every((k) => k === "snapshot")) mutate(scope, (bs) => bs.map((b) => (b.id === boardId ? apply(b) : b)));
  else touch(scope, boardId, apply);
}

export function removeTile(scope: string, boardId: string, tileId: string): void {
  touch(scope, boardId, (b) => ({ ...b, tiles: b.tiles.filter((t) => t.id !== tileId) }));
}

/** a copy lands right after the original */
export function duplicateTile(scope: string, boardId: string, tileId: string): void {
  touch(scope, boardId, (b) => {
    const sorted = b.tiles.slice().sort(byOrder);
    const i = sorted.findIndex((t) => t.id === tileId);
    if (i < 0) return b;
    const src = sorted[i];
    const copy = { ...src, id: uid(), ...(src.kind === "chart" ? { title: src.title } : {}) } as Tile;
    sorted.splice(i + 1, 0, copy);
    return { ...b, tiles: sorted.map((t, n) => ({ ...t, order: n })) };
  });
}

/** the tiles in this order, by id */
export function reorderTiles(scope: string, boardId: string, ids: string[]): void {
  const pos = new Map(ids.map((id, i) => [id, i]));
  touch(scope, boardId, (b) => ({ ...b, tiles: b.tiles.map((t) => ({ ...t, order: pos.get(t.id) ?? t.order })) }));
}

export function sortedTiles(board: Board): Tile[] {
  return board.tiles.slice().sort(byOrder);
}

export function nextSize(s: TileSize): TileSize {
  return TILE_SIZES[(TILE_SIZES.indexOf(s) + 1) % TILE_SIZES.length];
}

/* ------------------------------------------------------------------ */
/* answers into tiles                                                  */

const TABLE_VISUAL: VisualSpec = {
  stats: [],
  panels: [{ title: "Rows", kind: "table", series: [], markers: [], bands: [], stacked: false, sortDir: "desc", referenceLines: [], width: "full" }],
  callouts: [],
};

/** the rows a tile keeps, capped */
export function snapshotOf(result: { columns: ColumnMeta[]; rows: Row[] }, names: Names, anchor?: string | null): Snapshot {
  return { columns: result.columns, rows: result.rows.slice(0, SNAPSHOT_ROWS), names, at: Date.now(), anchor: anchor ?? null };
}

/** an answer, or one of its panels, as a tile; null when there is no SQL to run again */
export function pinAnswer(answer: QueryAnswer, opts: { panelIndex?: number | null; thread?: string[] } = {}): ChartTile | null {
  if (!answer.sql) return null;
  const visual = answer.visual ?? TABLE_VISUAL;
  const panelIndex = opts.panelIndex ?? null;
  const panel = panelIndex !== null ? visual.panels[panelIndex] : undefined;
  if (panelIndex !== null && !panel) return null;
  const size: TileSize = !panel ? "w" : panel.kind === "table" ? "w" : panel.width === "half" ? "m" : "l";
  // the whole thread, so Open asks the refined question and not its last words
  const [question = answer.title, ...then] = (opts.thread ?? []).map((q) => q.trim()).filter(Boolean);
  return {
    kind: "chart",
    id: uid(),
    question,
    ...(then.length ? { then } : {}),
    title: panel?.title || answer.title,
    sql: answer.sql,
    // callouts are sentences about one day's rows; a board reruns them
    visual: { ...visual, callouts: [] },
    panelIndex,
    drill: answer.drill ?? null,
    size,
    order: 0,
    snapshot: answer.result ? snapshotOf(answer.result, answer.names, answer.anchor) : undefined,
  };
}

export function noteTile(text = "## A heading\nA line on what this board watches."): NoteTile {
  return { kind: "note", id: uid(), text, size: "w", order: 0 };
}

/* a layout that came from elsewhere (a link, the account) gets every
   field the charts read, so a short or old one draws instead of throwing */
export function normalVisual(v: Partial<VisualSpec> | undefined): VisualSpec {
  const panels: Panel[] = (Array.isArray(v?.panels) ? (v.panels as Partial<Panel>[]) : []).map((p) => ({
    ...(p as Panel),
    markers: p.markers ?? [],
    bands: p.bands ?? [],
    referenceLines: p.referenceLines ?? [],
    stacked: p.stacked ?? false,
    sortDir: p.sortDir ?? "desc",
    width: p.width ?? "full",
    series: (Array.isArray(p.series) ? (p.series as Partial<Panel["series"][number]>[]) : []).map((x) => ({
      ...(x as Panel["series"][number]),
      format: x.format ?? "number",
      axis: x.axis ?? "left",
      mark: x.mark ?? "auto",
      transform: x.transform ?? "none",
      dashed: x.dashed ?? false,
    })),
  }));
  return { stats: Array.isArray(v?.stats) ? v.stats : [], panels: panels.length ? panels : TABLE_VISUAL.panels, callouts: [] };
}

function normalTile(t: Tile): Tile {
  return t.kind === "chart" ? { ...t, visual: normalVisual(t.visual) } : t;
}

/** tiles as another account keeps them (a shared board), in their order and drawable */
export function sharedTiles(raw: unknown[]): Tile[] {
  return (raw as Tile[]).filter((t) => t && (t.kind === "chart" || t.kind === "note")).map(normalTile).sort(byOrder);
}

/* ------------------------------------------------------------------ */
/* the first share links: the board without its rows, as base64url JSON.
   A board's own page is its link now; links already sent still open.  */

interface Shared {
  v: 1;
  name: string;
  tiles: (Omit<ChartTile, "id" | "order" | "snapshot"> | Omit<NoteTile, "id" | "order">)[];
}

/** a shared tile before it is checked: any field may be missing or wrong */
type Loose = Partial<Omit<ChartTile, "kind">> & Partial<Omit<NoteTile, "kind">> & { kind?: string };

function fromB64url(s: string): string {
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((s.length + 3) % 4);
  const bin = atob(b64);
  return new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)));
}

const isSize = (s: unknown): s is TileSize => TILE_SIZES.includes(s as TileSize);

/** a shared board, checked for shape; null when the link is not one */
export function decodeBoard(s: string): { name: string; tiles: Tile[] } | null {
  try {
    const raw = JSON.parse(fromB64url(s)) as Shared;
    if (raw?.v !== 1 || !Array.isArray(raw.tiles)) return null;
    const tiles: Tile[] = [];
    for (const [i, t] of (raw.tiles as Loose[]).slice(0, 40).entries()) {
      const size = isSize(t.size) ? t.size : "m";
      if (t.kind === "note" && typeof t.text === "string") tiles.push({ kind: "note", id: uid(), text: t.text.slice(0, 4000), size, order: i });
      else if (t.kind === "chart" && typeof t.sql === "string" && t.visual && Array.isArray(t.visual.panels)) {
        tiles.push({
          kind: "chart",
          id: uid(),
          question: String(t.question ?? ""),
          title: String(t.title ?? ""),
          sql: t.sql,
          visual: normalVisual(t.visual),
          panelIndex: typeof t.panelIndex === "number" && t.panelIndex < t.visual.panels.length ? t.panelIndex : null,
          view: t.view,
          size,
          order: i,
        });
      }
    }
    return { name: String(raw.name ?? "Shared board").slice(0, 80), tiles };
  } catch {
    return null;
  }
}


/* ------------------------------------------------------------------ */
/* the hook                                                            */

function subscribe(fn: () => void): () => void {
  const onStorage = (e: StorageEvent) => {
    if (e.key === KEY || e.key === null) fn();
  };
  window.addEventListener("storage", onStorage);
  window.addEventListener(EVENT, fn);
  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener(EVENT, fn);
  };
}

const NONE: Board[] = [];
// one parse per change of the stored string, so renders keep their arrays
const cache = new Map<string, { raw: string | null; boards: Board[] }>();
function snapshot(scope: string): Board[] {
  const raw = readRaw();
  const hit = cache.get(scope);
  if (hit && hit.raw === raw) return hit.boards;
  const boards = (parse(raw)[scope] ?? []).slice().sort((a, b) => b.updatedAt - a.updatedAt);
  const out = boards.length ? boards : NONE;
  cache.set(scope, { raw, boards: out });
  return out;
}

/** a scope's boards, newest first, live across tabs; empty on the server */
export function useBoards(scope: string) {
  const boards = useSyncExternalStore(
    subscribe,
    () => snapshot(scope),
    () => NONE,
  );
  const sync = useBoardSync(scope);
  return {
    boards,
    /** off: kept on this device only; loading: reading the account */
    sync,
    create: (name?: string, tiles?: Tile[]) => createBoard(scope, name, tiles),
    rename: (id: string, name: string) => renameBoard(scope, id, name),
    remove: (id: string) => deleteBoard(scope, id),
    addTile: (id: string, tile: Tile) => addTile(scope, id, tile),
    updateTile: (id: string, tileId: string, patch: Partial<ChartTile> | Partial<NoteTile>) => updateTile(scope, id, tileId, patch),
    removeTile: (id: string, tileId: string) => removeTile(scope, id, tileId),
    duplicateTile: (id: string, tileId: string) => duplicateTile(scope, id, tileId),
    reorder: (id: string, ids: string[]) => reorderTiles(scope, id, ids),
  };
}

/** false until the first client render, so the server and client agree */
export function useHydrated(): boolean {
  return useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
}
