import { notFound } from "next/navigation";
import { getExplorerChain } from "@/lib/pchain-explorer";
import { PchainHome } from "@/components/explorer-v2/pchain/PchainHome";

// Route: /explorer/{network}/p-chain — the [network] segment carries the
// network (mainnet | fuji); the chain is the static "p-chain".
export default async function ExplorerNetworkHome({
  params,
}: {
  params: Promise<{ network: string }>;
}) {
  const { network } = await params;
  const c = getExplorerChain("p-chain");
  if (!c || !c.networks.includes(network)) notFound();
  return <PchainHome chain={c.slug} network={network} />;
}
