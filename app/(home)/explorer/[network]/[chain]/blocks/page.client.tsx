"use client";

import { EvmBlocksList } from "@/components/explorer-v2/evm/EvmBlocksList";

export function BlocksPageClient({ network }: { network: string }) {
  return <EvmBlocksList network={network} />;
}
