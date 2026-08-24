import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { isPchainNetwork } from "@/lib/pchain-explorer";
import { chainCardMetadata } from "@/utils/explorer-metadata";
import { AtomicTxDetail } from "@/components/explorer-v2/evm/AtomicPages";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ network: string; chain: string; id: string }>;
}): Promise<Metadata> {
  const { network, chain: chainSlug, id } = await params;
  return chainCardMetadata({
    chainSlug,
    title: "Atomic Transaction | C-Chain Explorer",
    description: "Cross-chain atomic transaction detail on the Avalanche C-Chain.",
    url: `/explorer/${network}/${chainSlug}/atomic-tx/${id}`,
  });
}

export default async function AtomicTxPage({ params }: { params: Promise<{ network: string; chain: string; id: string }> }) {
  const { network, chain, id } = await params;
  if (!isPchainNetwork(network) || chain !== "c-chain") notFound();
  return <AtomicTxDetail network={network} chainSlug={chain} txHash={decodeURIComponent(id)} />;
}
