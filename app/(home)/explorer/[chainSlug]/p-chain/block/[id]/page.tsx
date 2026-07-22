import { notFound } from "next/navigation";
import { getExplorerChain } from "@/lib/pchain-explorer";
import { PchainBlock } from "@/components/explorer-v2/pchain/PchainBlock";

export default async function BlockPage({
  params,
}: {
  params: Promise<{ chainSlug: string; id: string }>;
}) {
  const { chainSlug: network, id } = await params;
  const c = getExplorerChain("p-chain");
  if (!c || !c.networks.includes(network)) notFound();
  return <PchainBlock chain={c.slug} network={network} id={decodeURIComponent(id)} />;
}
