"use client";

import { EvmQueryBoard } from "@/components/explorer-v2/evm/QueryBoard";

export function QueryBoardClient({ network, id }: { network: string; id: string }) {
  return <EvmQueryBoard network={network} id={id} />;
}
