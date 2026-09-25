"use client";

import { Suspense } from "react";
import { EvmQuery } from "@/components/explorer-v2/evm/EvmQuery";

// the page reads ?q, so it renders under a Suspense boundary
export function QueryPageClient({ network }: { network: string }) {
  return (
    <Suspense>
      <EvmQuery network={network} />
    </Suspense>
  );
}
