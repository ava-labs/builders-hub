"use client";

import { EvmQueryBoard } from "@/components/explorer-v2/evm/QueryBoard";
import type { SharedBoard } from "@/lib/explorer-query/board-wire";

export function QueryBoardClient({ network, id, shared }: { network: string; id: string; shared: SharedBoard | null }) {
  return <EvmQueryBoard network={network} id={id} shared={shared} />;
}
