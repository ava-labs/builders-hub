"use client";

import { EvmAddress } from "@/components/explorer-v2/evm/EvmAddress";

export function AddressDetailPageClient({
  network,
  address,
}: {
  network: string;
  address: string;
  // sourcifySupport is accepted for call-site compatibility; the activity-only
  // explorer doesn't surface source verification.
  sourcifySupport?: boolean;
}) {
  return <EvmAddress network={network} addr={address} />;
}
