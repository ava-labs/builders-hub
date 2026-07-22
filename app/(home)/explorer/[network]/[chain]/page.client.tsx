"use client";

import { EvmHome } from "@/components/explorer-v2/evm/EvmHome";

export function ChainExplorerPageClient({ network }: { network: string }) {
  // chain identity comes from the layout's ChainContext; EvmShell reads it.
  return <EvmHome network={network} />;
}
