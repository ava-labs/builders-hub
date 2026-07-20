import { notFound } from "next/navigation";
import { getExplorerChain } from "@/lib/pchain-explorer";
import { PchainNode } from "@/components/explorer-v2/pchain/PchainNode";

export default async function NodePage({
  params,
}: {
  params: Promise<{ network: string; nodeId: string }>;
}) {
  const { network, nodeId } = await params;
  const c = getExplorerChain("p-chain");
  if (!c || !c.networks.includes(network)) notFound();
  return <PchainNode chain={c.slug} network={network} nodeId={decodeURIComponent(nodeId)} />;
}
