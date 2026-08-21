import { notFound } from "next/navigation";
import { isPchainNetwork } from "@/lib/pchain-explorer";
import { AtomicTxDetail } from "@/components/explorer-v2/evm/AtomicPages";

export default async function AtomicTxPage({ params }: { params: Promise<{ network: string; chain: string; id: string }> }) {
  const { network, chain, id } = await params;
  if (!isPchainNetwork(network) || chain !== "c-chain") notFound();
  return <AtomicTxDetail network={network} chainSlug={chain} txHash={decodeURIComponent(id)} />;
}
