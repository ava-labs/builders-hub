"use client";

import { Suspense } from "react";
import { EvmQueryBoards } from "@/components/explorer-v2/evm/QueryBoard";

// the page reads ?board (a shared board), so it renders under a Suspense boundary
export function QueryBoardsClient({ network }: { network: string }) {
  return (
    <Suspense>
      <EvmQueryBoards network={network} />
    </Suspense>
  );
}
