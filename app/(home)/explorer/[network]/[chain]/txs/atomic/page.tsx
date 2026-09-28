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
    description: "Cross-chain (atomic) imports and exports between the Avalanche C-Chain and the P-Chain or X-Chain.",
    url: `/explorer/${network}/${chainSlug}/txs/atomic`,
  });
}

// The Transactions tab's second view. Atomic (cross-chain) txs exist only
// on the C-Chain: other EVM L1s have no shared-memory layer, so this view
// 404s off c-chain. The old /atomic URL 308s here (next.config.mjs).
export default async function AtomicPage({
  params,
  searchParams,
}: {
  params: Promise<{ network: string; chain: string }>;
  searchParams: Promise<{ address?: string | string[] }>;
}) {
  const { network, chain } = await params;
  if (!isPchainNetwork(network) || chain !== "c-chain") notFound();
  // ?address=0x… narrows the list to one C-Chain address
  const { address } = await searchParams;
  return <AtomicTxsList network={network} chainSlug={chain} address={typeof address === "string" ? address : undefined} />;
}
