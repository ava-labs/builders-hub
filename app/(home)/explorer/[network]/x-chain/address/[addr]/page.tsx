import { notFound } from "next/navigation";
import { isPchainNetwork } from "@/lib/pchain-explorer";
import { XchainAddress } from "@/components/explorer-v2/xchain/XchainPages";

export default async function XchainAddressPage({ params }: { params: Promise<{ network: string; addr: string }> }) {
  const { network, addr } = await params;
  if (!isPchainNetwork(network)) notFound();
  return <XchainAddress network={network} addr={decodeURIComponent(addr)} />;
}
