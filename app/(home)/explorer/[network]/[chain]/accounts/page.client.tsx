"use client";

import { EvmAccounts } from "@/components/explorer-v2/evm/EvmAccounts";

export function AccountsPageClient({ network }: { network: string }) {
  return <EvmAccounts network={network} />;
}
