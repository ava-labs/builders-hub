"use client";

/* What the board's files share: a row, the canvas's hooks into the store,
   a tile's context, the button styles, the inline name field and the
   copy hook. */

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import type { ChartTile, MetricTile, Snapshot, useBoards } from "@/lib/explorer-query/board";

export type Row = Record<string, unknown>;
type Kind = "evm" | "pchain";

export const btn =
  "inline-flex items-center gap-1.5 rounded-full border border-zinc-200 bg-white px-3 py-1.5 font-mono text-[10.5px] font-bold uppercase tracking-[0.12em] text-zinc-600 transition-colors hover:border-zinc-900 hover:text-zinc-900 disabled:opacity-40 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-300 dark:hover:border-zinc-100 dark:hover:text-zinc-50";
export const iconBtn =
  "inline-flex h-7 w-7 items-center justify-center rounded-full text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-900 disabled:opacity-40 dark:text-zinc-500 dark:hover:bg-zinc-900 dark:hover:text-zinc-100";

export const primary =
  "inline-flex items-center gap-1.5 rounded-full bg-zinc-900 px-3.5 py-1.5 font-mono text-[10.5px] font-bold uppercase tracking-[0.12em] text-zinc-50 transition-opacity hover:opacity-85 dark:bg-zinc-50 dark:text-zinc-900";

export function InlineName({ value, onSave, className, placeholder }: { value: string; onSave: (v: string) => void; className?: string; placeholder?: string }) {
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

/** what a canvas can do to its board; a board the reader does not own only keeps its rows */
export type BoardApi = Pick<ReturnType<typeof useBoards>, "rename" | "remove" | "addTile" | "updateTile" | "removeTile" | "duplicateTile" | "reorder">;

export interface TileCtx {
  scope: string;
  boardId: string;
  chainId: number | string;
  network: string;
  chainSlug: string;
  sym: string;
  /** the chain's explorer pages, where a row opens */
  base: string;
  api: BoardApi;
  /** a board the reader does not own: it draws and refreshes, nothing else */
  readOnly: boolean;
  /** a tile's rows, in the sheet: the ones it kept, or the ones given */
  onRows: (tile: ChartTile | MetricTile, snap?: Snapshot | null) => void;
  /** a mark or a row: the page of the thing it names, else its records */
  onMark: (tile: ChartTile, row: Row) => void;
  /** a row of a list: its records */
  onDrill: (tile: ChartTile, row: Row) => void;
}

export interface Handle {
  ref?: (el: HTMLElement | null) => void;
  props?: Record<string, unknown>;
}

export interface BoardPageProps {
  network: string;
  chainSlug: string;
  chainId: number | string;
  kind: Kind;
  sym: string;
}

export function useCopied(): [boolean, (text: string) => void] {
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
