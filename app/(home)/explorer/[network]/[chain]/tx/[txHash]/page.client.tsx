"use client";

import { EvmTx } from "@/components/explorer-v2/evm/EvmTx";

export function TransactionDetailPageClient({ network, txHash }: { network: string; txHash: string }) {
  return <EvmTx network={network} txHash={txHash} />;
}
