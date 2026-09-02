import { notFound } from "next/navigation";
import { isPchainNetwork } from "@/lib/pchain-explorer";
import { XchainBlock } from "@/components/explorer-v2/xchain/XchainPages";

export default async function Page({ params }: { params: Promise<{ network: string; height: string }> }) {
  const { network, height } = await params;
  if (!isPchainNetwork(network)) notFound();
  return <XchainBlock network={network} height={height} />;
}
