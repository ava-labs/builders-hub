"use client";

import { EvmQuery } from "@/components/explorer-v2/evm/EvmQuery";

export function QueryPageClient({ network }: { network: string }) {
  return <EvmQuery network={network} />;
}
