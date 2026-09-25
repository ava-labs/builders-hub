"use client";

import { PchainQueryBoard } from "@/components/explorer-v2/evm/QueryBoard";

export function PchainQueryBoardClient({ network, id }: { network: string; id: string }) {
  return <PchainQueryBoard network={network} id={id} />;
}
