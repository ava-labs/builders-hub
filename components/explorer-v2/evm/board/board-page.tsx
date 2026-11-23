"use client";

/* One board's page: the reader's own board, a board another reader
   keeps, or the line that says no board is at this link. */

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { LayoutGrid } from "lucide-react";
import type { SyncState } from "@/lib/explorer-query/board-sync";
import type { SharedBoard } from "@/lib/explorer-query/board-wire";
import { boardHref, boardScope, boardsHref, movedBoard, sharedTiles, sortedTiles, useBoards, useHydrated, type Board, type Tile } from "@/lib/explorer-query/board";
import { QueryPageShell } from "@/components/explorer-v2/evm/query-board-bits";
import { BoardCanvas } from "./board-canvas";
import { SignInToSync } from "./board-share";
import { btn, type BoardApi, type BoardPageProps } from "./parts";

/** a board another reader keeps, or a link that carried one: drawn and refreshed here, kept nowhere until the reader saves a copy */
export function GuestBoard({ shared, props }: { shared: { id: string | null; name: string; tiles: Tile[]; updatedAt: number; link: string | null }; props: BoardPageProps }) {
  const router = useRouter();
  const { create, sync } = useBoards(boardScope(props.network, props.chainSlug));
  const [board, setBoard] = useState<Board>(() => ({ id: shared.id ?? "shared", name: shared.name, createdAt: shared.updatedAt, updatedAt: shared.updatedAt, tiles: shared.tiles }));
  // the rows each tile reads stay on this page; nothing else here is the reader's to change
  const api = useMemo<BoardApi>(
    () => ({
      rename: () => {},
      remove: () => {},
      addTile: (_id, t) => t,
      updateTile: (_id, tileId, patch) => setBoard((b) => ({ ...b, tiles: b.tiles.map((t) => (t.id === tileId ? ({ ...t, ...patch, id: t.id, kind: t.kind } as Tile) : t)) })),
      removeTile: () => {},
      duplicateTile: () => {},
      reorder: () => {},
    }),
    [],
  );
  // the copy keeps the rows this page read, so it opens drawn
  const save = () => router.push(boardHref(props.network, props.chainSlug, create(board.name, sortedTiles(board)).id));
  return <BoardCanvas board={board} props={props} api={api} sync={sync} guest={{ link: shared.link, onSave: save }} />;
}

function Missing({ sync, network, chainSlug }: { sync: SyncState; network: string; chainSlug: string }) {
  return (
    <div className="flex flex-col items-start gap-3 pt-10">
      <p className="text-[18px] font-medium tracking-tight text-zinc-900 dark:text-zinc-50">No board at this link</p>
      <p className="max-w-md text-[14px] text-zinc-500 dark:text-zinc-400">
        {sync === "off" ? "It may be kept on one device only. If it is yours, sign in to see the boards your account keeps." : "It was deleted, or no account keeps it."}
      </p>
      {sync === "off" && <SignInToSync />}
      <Link href={boardsHref(network, chainSlug)} className={btn}>
        <LayoutGrid className="h-3.5 w-3.5" /> All boards
      </Link>
    </div>
  );
}

/** one board: the reader's own, from this device's store; else the board its link opens */
export function QueryBoardPage({ boardId, shared, ...props }: BoardPageProps & { boardId: string; shared: SharedBoard | null }) {
  const hydrated = useHydrated();
  const router = useRouter();
  const api = useBoards(boardScope(props.network, props.chainSlug));
  const board = api.boards.find((b) => b.id === boardId);
  // a board whose id had to change: its page follows it
  const moved = hydrated && !board ? movedBoard(boardId) : undefined;
  useEffect(() => {
    if (moved) router.replace(boardHref(props.network, props.chainSlug, moved));
  }, [moved, router, props.network, props.chainSlug]);
  const guest = useMemo(
    () => (shared ? { id: shared.id, name: shared.name, tiles: sharedTiles(shared.tiles), updatedAt: shared.updatedAt, link: boardHref(props.network, props.chainSlug, shared.id) } : null),
    [shared, props.network, props.chainSlug],
  );
  return (
    <QueryPageShell kind={props.kind} network={props.network}>
      {!hydrated || moved || (!board && !guest && api.sync === "loading") ? (
        <div className="h-96" aria-busy="true" />
      ) : board ? (
        <BoardCanvas board={board} props={props} api={api} sync={api.sync} />
      ) : guest ? (
        <GuestBoard key={guest.id} shared={guest} props={props} />
      ) : (
        <Missing sync={api.sync} network={props.network} chainSlug={props.chainSlug} />
      )}
    </QueryPageShell>
  );
}
