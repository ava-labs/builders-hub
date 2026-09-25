"use client";

/* The small parts boards are made of: the refresh queue, the clock, the
   note grammar, the board thumbnail and the page chrome. Shared by the
   canvas (QueryBoard.tsx), the Query home (QueryHome.tsx) and the tab. */

import { Fragment, useEffect, useState } from "react";
import { EvmShell } from "@/components/explorer-v2/EvmShell";
import { ExplorerShell } from "@/components/explorer-v2/ExplorerShell";
import { cn } from "@/lib/utils";
import { SIZE_SPAN, sortedTiles, type Board, type Tile } from "@/lib/explorer-query/board";
import type { QueryResult } from "@/lib/explorer-query/clickhouse";
import type { Names } from "@/lib/explorer-query/types";

/* ------------------------------------------------------------------ */
/* the refresh queue: the query route is shared and rate limited, so a  */
/* board never has more than two queries out, and starts them apart     */

const MAX_IN_FLIGHT = 2;
const GAP_MS = 350;
let inFlight = 0;
let lastStart = 0;
let timer: ReturnType<typeof setTimeout> | null = null;
const waiting: (() => void)[] = [];

function pump() {
  if (timer) return;
  while (inFlight < MAX_IN_FLIGHT && waiting.length) {
    const wait = lastStart + GAP_MS - Date.now();
    if (wait > 0) {
      timer = setTimeout(() => {
        timer = null;
        pump();
      }, wait);
      return;
    }
    lastStart = Date.now();
    inFlight++;
    waiting.shift()!();
  }
}

export interface SqlRun {
  sql: string;
  result: QueryResult;
  names: Names;
  anchor?: string | null;
}

// one run per tile at a time, however many times it mounts
const running = new Map<string, Promise<SqlRun>>();

/** the tile's SQL again, no model: the route's `sql` mode */
export function runTileSql(key: string, chainId: number | string, sql: string): Promise<SqlRun> {
  const open = running.get(key);
  if (open) return open;
  const p = new Promise<SqlRun>((resolve, reject) => {
    waiting.push(async () => {
      try {
        const res = await fetch("/api/explorer/query", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ chainId, sql }),
        });
        const out = (await res.json().catch(() => ({}))) as Partial<SqlRun> & { error?: string };
        if (!res.ok || out.error || !out.result) throw new Error(out.error ?? `HTTP ${res.status}`);
        resolve(out as SqlRun);
      } catch (e) {
        reject(e instanceof Error ? e : new Error(String(e)));
      } finally {
        inFlight--;
        running.delete(key);
        pump();
      }
    });
    pump();
  });
  running.set(key, p);
  return p;
}

/* ------------------------------------------------------------------ */
/* time                                                                */

/** a clock that ticks every `ms`, for "3m ago" lines */
export function useNow(ms = 30_000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(id);
  }, [ms]);
  return now;
}

export function ago(at: number, now: number): string {
  const s = Math.max(0, Math.round((now - at) / 1000));
  if (s < 45) return "just now";
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.round(h / 24);
  return d < 30 ? `${d}d ago` : new Date(at).toLocaleDateString();
}

/* ------------------------------------------------------------------ */
/* notes: a markdown-lite. # and ## are headings, - is a list item,     */
/* **bold** and `code` inline, a blank line starts a paragraph          */

function inline(text: string): React.ReactNode[] {
  const out: React.ReactNode[] = [];
  const re = /(\*\*[^*]+\*\*|`[^`]+`)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let k = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const t = m[0];
    out.push(
      t.startsWith("**") ? (
        <strong key={k++} className="font-semibold text-zinc-900 dark:text-zinc-50">
          {t.slice(2, -2)}
        </strong>
      ) : (
        <code key={k++} className="rounded bg-zinc-100 px-1 py-0.5 font-mono text-[0.9em] dark:bg-zinc-900">
          {t.slice(1, -1)}
        </code>
      ),
    );
    last = m.index + t.length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

export function NoteBody({ text }: { text: string }) {
  const blocks: React.ReactNode[] = [];
  let list: string[] = [];
  let para: string[] = [];
  const flushPara = () => {
    if (para.length) {
      blocks.push(
        <p key={blocks.length} className="text-[14px] leading-relaxed text-zinc-600 dark:text-zinc-400">
          {para.map((l, i) => (
            <Fragment key={i}>
              {i > 0 && <br />}
              {inline(l)}
            </Fragment>
          ))}
        </p>,
      );
      para = [];
    }
  };
  const flushList = () => {
    if (list.length) {
      blocks.push(
        <ul key={blocks.length} className="flex list-disc flex-col gap-1 pl-5 text-[14px] leading-relaxed text-zinc-600 marker:text-zinc-300 dark:text-zinc-400 dark:marker:text-zinc-700">
          {list.map((l, i) => (
            <li key={i}>{inline(l)}</li>
          ))}
        </ul>,
      );
      list = [];
    }
  };
  const flush = () => {
    flushPara();
    flushList();
  };
  for (const raw of text.split("\n")) {
    const line = raw.trimEnd();
    if (!line.trim()) {
      flush();
    } else if (/^#\s/.test(line)) {
      flush();
      blocks.push(
        <h2 key={blocks.length} className="text-[22px] font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          {inline(line.slice(2))}
        </h2>,
      );
    } else if (/^##+\s/.test(line)) {
      flush();
      blocks.push(
        <h3 key={blocks.length} className="text-[16px] font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          {inline(line.replace(/^##+\s/, ""))}
        </h3>,
      );
    } else if (/^[-*]\s/.test(line)) {
      flushPara();
      list.push(line.slice(2));
    } else {
      flushList();
      para.push(line);
    }
  }
  flush();
  return <div className="flex flex-col gap-2.5">{blocks}</div>;
}

/* ------------------------------------------------------------------ */
/* the thumbnail: the board's tiles as blocks on a tiny 12-col grid,    */
/* each drawing a glyph of its chart                                    */

function Glyph({ tile }: { tile: Tile }) {
  const ink = "stroke-zinc-400 dark:stroke-zinc-500";
  if (tile.kind === "note")
    return (
      <svg viewBox="0 0 40 20" className="h-full w-full" preserveAspectRatio="none" aria-hidden>
        <line x1="3" y1="6" x2="22" y2="6" className="stroke-zinc-500 dark:stroke-zinc-400" strokeWidth="2.2" strokeLinecap="round" />
        <line x1="3" y1="12" x2="34" y2="12" className={ink} strokeWidth="1.2" strokeLinecap="round" />
        <line x1="3" y1="16" x2="28" y2="16" className={ink} strokeWidth="1.2" strokeLinecap="round" />
      </svg>
    );
  const panel = tile.panelIndex !== null ? tile.visual.panels[tile.panelIndex] : tile.visual.panels[0];
  const kind = tile.view ?? panel?.kind ?? "table";
  if (kind === "hbar")
    return (
      <svg viewBox="0 0 40 20" className="h-full w-full" preserveAspectRatio="none" aria-hidden>
        {[30, 24, 17, 12, 8].map((w, i) => (
          <rect key={i} x="3" y={2.5 + i * 3.3} width={w} height="2" rx="1" className={i === 0 ? "fill-[#E6212F]/80" : "fill-zinc-300 dark:fill-zinc-600"} />
        ))}
      </svg>
    );
  if (kind === "bar")
    return (
      <svg viewBox="0 0 40 20" className="h-full w-full" preserveAspectRatio="none" aria-hidden>
        {[8, 11, 7, 14, 10, 16, 12, 9].map((h, i) => (
          <rect key={i} x={3 + i * 4.4} y={18 - h} width="2.8" height={h} rx="0.6" className={i === 5 ? "fill-[#E6212F]/80" : "fill-zinc-300 dark:fill-zinc-600"} />
        ))}
      </svg>
    );
  if (kind === "table")
    return (
      <svg viewBox="0 0 40 20" className="h-full w-full" preserveAspectRatio="none" aria-hidden>
        {[4, 8.5, 13, 17.5].map((y, i) => (
          <line key={i} x1="3" y1={y} x2="37" y2={y} className={i === 0 ? "stroke-zinc-500 dark:stroke-zinc-400" : ink} strokeWidth={i === 0 ? 1.6 : 1} strokeLinecap="round" />
        ))}
      </svg>
    );
  if (kind === "scatter")
    return (
      <svg viewBox="0 0 40 20" className="h-full w-full" preserveAspectRatio="none" aria-hidden>
        {[[6, 15], [10, 12], [14, 13], [18, 9], [23, 10], [27, 6], [31, 7], [35, 4]].map(([x, y], i) => (
          <circle key={i} cx={x} cy={y} r="1.2" className="fill-[#0061E2]/70" />
        ))}
      </svg>
    );
  return (
    <svg viewBox="0 0 40 20" className="h-full w-full" preserveAspectRatio="none" aria-hidden>
      {kind === "area" && <path d="M3 16 L9 12 L15 13 L21 8 L27 10 L33 5 L37 6 L37 19 L3 19 Z" className="fill-[#E6212F]/15" />}
      <path d="M3 16 L9 12 L15 13 L21 8 L27 10 L33 5 L37 6" fill="none" className="stroke-[#E6212F]" strokeWidth="1.4" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

export function BoardThumb({ board, className }: { board: Board; className?: string }) {
  const tiles = sortedTiles(board).slice(0, 9);
  return (
    <div className={cn("grid auto-rows-[1.6rem] grid-cols-12 gap-1", className)} aria-hidden>
      {tiles.length === 0 ? (
        <div className="col-span-12 row-span-2 rounded-md border border-dashed border-zinc-300 dark:border-zinc-700" />
      ) : (
        tiles.map((t) => (
          <div
            key={t.id}
            className={cn("rounded-[5px] border p-1", t.kind === "note" ? "border-transparent" : "border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900/60")}
            style={{ gridColumn: `span ${SIZE_SPAN[t.size]} / span ${SIZE_SPAN[t.size]}` }}
          >
            <Glyph tile={t} />
          </div>
        ))
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* the page chrome: the same shells the Query page wears                */

export function QueryPageShell({ kind, network, children }: { kind: "evm" | "pchain"; network: string; children: React.ReactNode }) {
  if (kind === "pchain")
    return (
      <ExplorerShell chain="p-chain" network={network} hideHeader>
        <div className="mx-auto w-full max-w-[90rem] px-5 pb-24 pt-2 md:px-6">{children}</div>
      </ExplorerShell>
    );
  return (
    <EvmShell network={network} search={false}>
      {children}
    </EvmShell>
  );
}

/** mono section label, the sheet's voice */
export function Label({ children, className }: { children: React.ReactNode; className?: string }) {
  return <span className={cn("font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400", className)}>{children}</span>;
}
