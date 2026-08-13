import { notFound } from "next/navigation";
import { getExplorerChain } from "@/lib/pchain-explorer";
import { PchainNode } from "@/components/explorer-v2/pchain/PchainNode";

export default async function NodePage({
  params,
  searchParams,
}: {
  params: Promise<{ network: string; nodeId: string }>;
  searchParams: Promise<{ subnet?: string }>;
}) {
  const { network, nodeId } = await params;
  const { subnet } = await searchParams;
  const c = getExplorerChain("x-chain");
  if (!c || !c.networks.includes(network)) notFound();
  return (
    <PchainNode
      chain="x-chain"
      network={network}
      nodeId={decodeURIComponent(nodeId)}
      subnetHint={subnet}
    />
  );
}
