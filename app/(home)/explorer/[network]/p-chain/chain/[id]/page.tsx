import { notFound } from "next/navigation";
import { getExplorerChain } from "@/lib/pchain-explorer";
import { PchainChain } from "@/components/explorer-v2/pchain/PchainChain";

export default async function ChainPage({
  params,
}: {
  params: Promise<{ network: string; id: string }>;
}) {
  const { network, id } = await params;
  const c = getExplorerChain("p-chain");
  if (!c || !c.networks.includes(network)) notFound();
  return <PchainChain chain={c.slug} network={network} id={decodeURIComponent(id)} />;
}
