"use client";

import { Suspense } from "react";
import { NetworkQuery, type IndexState, type NetworkQueryChain } from "@/components/explorer-v2/evm/EvmQuery";

// the page reads ?q and ?chain, so it renders under a Suspense boundary. The
// boundary sits here, inside the client tree: one on the server, around the
// client page, showed its empty fallback while the page's code loaded, and
// React then held the page back 300 ms before it showed it
export function NetworkQueryClient({ network, chains, index }: { network: string; chains: NetworkQueryChain[]; index: Promise<IndexState[]> }) {
  return (
    <Suspense>
      <NetworkQuery network={network} chains={chains} index={index} />
    </Suspense>
  );
}
