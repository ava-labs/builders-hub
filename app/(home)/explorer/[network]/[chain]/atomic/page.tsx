import { notFound } from "next/navigation";
import { isPchainNetwork } from "@/lib/pchain-explorer";
import { AtomicTxsList } from "@/components/explorer-v2/evm/AtomicPages";

// Atomic (cross-chain) txs exist only for the C-Chain — other EVM L1s have
// no shared-memory layer, so this tab 404s off c-chain.
export default async function AtomicPage({ params }: { params: Promise<{ network: string; chain: string }> }) {
  const { network, chain } = await params;
  if (!isPchainNetwork(network) || chain !== "c-chain") notFound();
  return <AtomicTxsList network={network} chainSlug={chain} />;
}
