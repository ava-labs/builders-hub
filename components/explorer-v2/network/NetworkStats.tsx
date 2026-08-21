"use client";

import { NetworkShell } from "@/components/explorer-v2/network/NetworkShell";
import { EvmStats } from "@/components/explorer-v2/evm/EvmStats";

/* The network-scope Stats facet: the same metrics sheet every chain's
   Stats tab mounts, aggregated across all indexed chains, inside the
   All Networks chrome. */
export function NetworkStats() {
  return (
    <NetworkShell
      eyebrow="Avalanche Ecosystem"
      title="Stats"
      intro="Aggregated activity across every indexed Avalanche chain: addresses, transactions, contracts, gas, and fees."
    >
      <EvmStats chainId="all" />
    </NetworkShell>
  );
}
