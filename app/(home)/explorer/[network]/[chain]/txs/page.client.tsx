"use client";

import { EvmTxsList } from "@/components/explorer-v2/evm/EvmTxsList";

export function TxsPageClient({ network }: { network: string }) {
  return <EvmTxsList network={network} />;
}
