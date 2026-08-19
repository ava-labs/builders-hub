import { notFound } from "next/navigation";
import { isPchainNetwork } from "@/lib/pchain-explorer";
import { XchainAsset } from "@/components/explorer-v2/xchain/XchainPages";

export default async function Page({ params }: { params: Promise<{ network: string; id: string }> }) {
  const { network, id } = await params;
  if (!isPchainNetwork(network)) notFound();
  return <XchainAsset network={network} assetId={decodeURIComponent(id)} />;
}
