"use client";

import { EvmAddress } from "@/components/explorer-v2/evm/EvmAddress";

export function AddressDetailPageClient({
  network,
  address,
  initialTab,
}: {
  network: string;
  address: string;
  initialTab?: string;
  // sourcifySupport is accepted for call-site compatibility. The Contract
  // tab doesn't consult it: verification is resolved per address, and our
  // own verifier covers chains Sourcify has never heard of.
  sourcifySupport?: boolean;
}) {
  return <EvmAddress network={network} addr={address} initialTab={initialTab} />;
}
