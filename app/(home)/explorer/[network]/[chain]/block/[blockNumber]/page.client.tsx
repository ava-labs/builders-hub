"use client";

import { EvmBlock } from "@/components/explorer-v2/evm/EvmBlock";

export function BlockDetailPageClient({ network, blockNumber }: { network: string; blockNumber: string }) {
  return <EvmBlock network={network} id={blockNumber} />;
}
