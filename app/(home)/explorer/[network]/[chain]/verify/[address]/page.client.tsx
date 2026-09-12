"use client";

import { EvmVerify } from "@/components/explorer-v2/evm/EvmVerify";

export function VerifyContractPageClient({
  network,
  address,
}: {
  network: string;
  address: string;
}) {
  return <EvmVerify network={network} addr={address} />;
}
