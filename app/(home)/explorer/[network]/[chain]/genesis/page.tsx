import { Metadata } from "next";
import { notFound } from "next/navigation";
import { ChainGenesisPageClient } from "./page.client";
import { chainCardMetadata } from "@/utils/explorer-metadata";

// The C-Chain's genesis block config, vendored from ava-labs/avalanchego
// (genesis/genesis_{mainnet,fuji}.json → cChainGenesis). Genesis is
// immutable, so the JSON ships with the repo instead of being fetched.
const NETWORKS = new Set(["mainnet", "fuji"]);

interface GenesisPageProps {
  params: Promise<{ network: string; chain: string }>;
}

export async function generateMetadata({ params }: GenesisPageProps): Promise<Metadata> {
  const { network, chain: chainSlug } = await params;
  return chainCardMetadata({
    chainSlug,
    title: `C-Chain Genesis (${network}) | Avalanche Explorer`,
    description: `The Avalanche C-Chain's genesis block configuration on ${network}: chain config, allocation, and EVM parameters.`,
    url: `/explorer/${network}/${chainSlug}/genesis`,
  });
}

export default async function ChainGenesisPage({ params }: GenesisPageProps) {
  const { network, chain } = await params;
  // only the C-Chain carries a vendored genesis — L1s publish their own
  if (chain !== "c-chain" || !NETWORKS.has(network)) notFound();
  return <ChainGenesisPageClient network={network} />;
}
