import { Metadata } from "next";
import { notFound } from "next/navigation";
import { ChainGenesisPageClient } from "./page.client";

// The C-Chain's genesis block config, vendored from ava-labs/avalanchego
// (genesis/genesis_{mainnet,fuji}.json → cChainGenesis). Genesis is
// immutable, so the JSON ships with the repo instead of being fetched.
const NETWORKS = new Set(["mainnet", "fuji"]);

interface GenesisPageProps {
  params: Promise<{ network: string; chain: string }>;
}

export async function generateMetadata({ params }: GenesisPageProps): Promise<Metadata> {
  const { network } = await params;
  return {
    title: `C-Chain Genesis (${network}) | Avalanche Explorer`,
    description: `The Avalanche C-Chain's genesis block configuration on ${network}: chain config, allocation, and EVM parameters.`,
  };
}

export default async function ChainGenesisPage({ params }: GenesisPageProps) {
  const { network, chain } = await params;
  // only the C-Chain carries a vendored genesis — L1s publish their own
  if (chain !== "c-chain" || !NETWORKS.has(network)) notFound();
  return <ChainGenesisPageClient network={network} />;
}
