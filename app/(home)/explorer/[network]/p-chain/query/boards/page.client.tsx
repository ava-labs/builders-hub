"use client";

import { Suspense } from "react";
import { PchainQueryBoards } from "@/components/explorer-v2/evm/QueryBoard";

// the page reads ?board (a shared board), so it renders under a Suspense boundary
export function PchainQueryBoardsClient({ network }: { network: string }) {
  return (
    <Suspense>
      <PchainQueryBoards network={network} />
    </Suspense>
  );
}
