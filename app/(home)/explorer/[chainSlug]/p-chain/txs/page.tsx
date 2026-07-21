import { notFound } from "next/navigation";
import { getExplorerChain } from "@/lib/pchain-explorer";
import { PchainTxsList } from "@/components/explorer-v2/pchain/PchainTxsList";

export default async function TxsPage({
  params,
}: {
  params: Promise<{ chainSlug: string }>;
}) {
  const { chainSlug: network } = await params;
  const c = getExplorerChain("p-chain");
  if (!c || !c.networks.includes(network)) notFound();
  return <PchainTxsList chain={c.slug} network={network} />;
}
