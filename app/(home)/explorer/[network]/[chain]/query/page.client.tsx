"use client";

import { Suspense } from "react";
import { EvmQuery, type IndexState } from "@/components/explorer-v2/evm/EvmQuery";

// the page reads ?q, so it renders under a Suspense boundary
export function QueryPageClient({ network, index }: { network: string; index: IndexState }) {
  return (
    <Suspense>
      <EvmQuery network={network} index={index} />
    </Suspense>
  );
}
