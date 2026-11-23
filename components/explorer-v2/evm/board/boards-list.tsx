"use client";

/* The board index: every board on a chain as a card, and the card that
   makes a new one. */

import { useMemo } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowUpRight, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { askHref, boardHref, boardScope, decodeBoard, useBoards, useHydrated, type Board } from "@/lib/explorer-query/board";
import { BoardThumb, QueryPageShell, ago, useNow } from "@/components/explorer-v2/evm/query-board-bits";
import { GuestBoard } from "./board-page";
import { SyncNote } from "./board-share";
import type { BoardPageProps } from "./parts";

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

/** every board on this chain; a link that carries a whole board opens it here, to view or keep */
export function QueryBoardsPage(props: BoardPageProps) {
  const { network, chainSlug, kind } = props;
  const hydrated = useHydrated();
  const { boards, sync } = useBoards(boardScope(network, chainSlug));
  const now = useNow();
  const link = useSearchParams().get("board");
  const carried = useMemo(() => (link ? decodeBoard(link) : null), [link]);
  if (link && carried)
    return (
      <QueryPageShell kind={kind} network={network}>
        {hydrated ? <GuestBoard shared={{ id: null, name: carried.name, tiles: carried.tiles, updatedAt: 0, link: null }} props={props} /> : <div className="h-96" aria-busy="true" />}
      </QueryPageShell>
    );

  return (
    <QueryPageShell kind={kind} network={network}>
      <div className="flex flex-col gap-8 pt-4">
        <div className="flex flex-col gap-4">
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
              Pages of charts built from your answers. Each chart keeps its SQL and runs again when you open the board.{" "}
              <SyncNote sync={sync} long />
            </p>
          </div>
          {link && <p className="border-l-2 border-[#E6212F] pl-3 font-mono text-[12px] text-[#E6212F]">That board link could not be read.</p>}
        </div>
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
