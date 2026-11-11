"use client";

/* Boards: a canvas of answers. Tiles sit on a 12-column grid (one
   column on a phone), drag by their grip to reorder, and take one of
   four widths. A chart tile draws at once from the rows it kept, then
   runs its SQL again behind the reader, two at a time. Every mark and
   row opens what it is about (a transaction, a contract, the records
   behind a bar), and a tile's rows open in a sheet. Notes carry the
   headings a dashboard needs, and a metric tile draws the stats API's
   daily series, as a Playground dashboard did. A board the account
   keeps opens for anyone with its link: drawn and refreshed, not
   edited, with a way to keep a copy. The parts live in ./board (the
   tiles, the canvas, the index, the pin control); the pages' entry
   points are here; the store is lib/explorer-query/board.ts. */

import { useChainContext } from "@/app/(home)/explorer/[network]/[chain]/layout.client";
import type { SharedBoard } from "@/lib/explorer-query/board-wire";
import { QueryBoardPage } from "./board/board-page";
import { QueryBoardsPage } from "./board/boards-list";

// the Query page's files import these three from here
export { BoardCard, NewBoardCard } from "./board/boards-list";
export { PinToBoard } from "./board/pin-to-board";

export function EvmQueryBoards({ network }: { network: string }) {
  const c = useChainContext();
  return <QueryBoardsPage network={network} chainSlug={c.chainSlug} chainId={c.chainId} kind="evm" sym={c.nativeToken ?? "AVAX"} />;
}

export function EvmQueryBoard({ network, id, shared }: { network: string; id: string; shared: SharedBoard | null }) {
  const c = useChainContext();
  return <QueryBoardPage network={network} chainSlug={c.chainSlug} chainId={c.chainId} kind="evm" sym={c.nativeToken ?? "AVAX"} boardId={id} shared={shared} />;
}

export function PchainQueryBoards({ network }: { network: string }) {
  return <QueryBoardsPage network={network} chainSlug="p-chain" chainId={network === "fuji" ? 5 : 1} kind="pchain" sym="AVAX" />;
}

export function PchainQueryBoard({ network, id, shared }: { network: string; id: string; shared: SharedBoard | null }) {
  return <QueryBoardPage network={network} chainSlug="p-chain" chainId={network === "fuji" ? 5 : 1} kind="pchain" sym="AVAX" boardId={id} shared={shared} />;
}
