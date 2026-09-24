"use client";

import { Suspense } from "react";
import { PchainQuery } from "@/components/explorer-v2/evm/EvmQuery";

// the page reads ?q, so it renders under a Suspense boundary
export function PchainQueryClient({ network }: { network: string }) {
  return (
    <Suspense>
      <PchainQuery network={network} />
    </Suspense>
  );
}
