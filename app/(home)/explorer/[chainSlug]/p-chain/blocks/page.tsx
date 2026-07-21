import { notFound } from "next/navigation";
import { getExplorerChain } from "@/lib/pchain-explorer";
import { PchainBlocksList } from "@/components/explorer-v2/pchain/PchainBlocksList";

export default async function BlocksPage({
  params,
}: {
  params: Promise<{ chainSlug: string }>;
}) {
  const { chainSlug: network } = await params;
  const c = getExplorerChain("p-chain");
  if (!c || !c.networks.includes(network)) notFound();
  return <PchainBlocksList chain={c.slug} network={network} />;
}
