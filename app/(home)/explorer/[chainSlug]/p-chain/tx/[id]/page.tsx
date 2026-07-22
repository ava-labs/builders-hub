import { notFound } from "next/navigation";
import { getExplorerChain } from "@/lib/pchain-explorer";
import { PchainTx } from "@/components/explorer-v2/pchain/PchainTx";

export default async function TxPage({
  params,
}: {
  params: Promise<{ chainSlug: string; id: string }>;
}) {
  const { chainSlug: network, id } = await params;
  const c = getExplorerChain("p-chain");
  if (!c || !c.networks.includes(network)) notFound();
  return <PchainTx chain={c.slug} network={network} txHash={decodeURIComponent(id)} />;
}
