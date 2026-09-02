import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { isPchainNetwork } from "@/lib/pchain-explorer";
import { chainCardMetadata } from "@/utils/explorer-metadata";
import { AtomicTxsList } from "@/components/explorer-v2/evm/AtomicPages";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ network: string; chain: string }>;
}): Promise<Metadata> {
  const { network, chain: chainSlug } = await params;
  return chainCardMetadata({
    chainSlug,
    title: "C-Chain Atomic Transactions | Avalanche Explorer",
    description: "Cross-chain (atomic) imports and exports on the Avalanche C-Chain.",
    url: `/explorer/${network}/${chainSlug}/atomic`,
  });
}

// Atomic (cross-chain) txs exist only for the C-Chain — other EVM L1s have
// no shared-memory layer, so this tab 404s off c-chain.
export default async function AtomicPage({ params }: { params: Promise<{ network: string; chain: string }> }) {
  const { network, chain } = await params;
  if (!isPchainNetwork(network) || chain !== "c-chain") notFound();
  return <AtomicTxsList network={network} chainSlug={chain} />;
}
