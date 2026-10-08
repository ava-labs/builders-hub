"use client";

import { PchainQueryBoard } from "@/components/explorer-v2/evm/QueryBoard";
import type { SharedBoard } from "@/lib/explorer-query/board-wire";

export function PchainQueryBoardClient({ network, id, shared }: { network: string; id: string; shared: SharedBoard | null }) {
  return <PchainQueryBoard network={network} id={id} shared={shared} />;
}
