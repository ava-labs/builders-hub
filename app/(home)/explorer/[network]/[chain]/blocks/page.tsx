import { Metadata } from "next";
import l1ChainsData from "@/constants/l1-chains.json";
import { L1Chain } from "@/types/stats";
import { BlocksPageClient } from "./page.client";
import { chainCardMetadata } from "@/utils/explorer-metadata";

interface PageProps {
  params: Promise<{ network: string; chain: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { network, chain: chainSlug } = await params;
  const chain = l1ChainsData.find((c) => c.slug === chainSlug) as L1Chain | undefined;
  const name = chain?.chainName ?? "Chain";
  return chainCardMetadata({
    chainSlug,
    title: `${name} Blocks | Avalanche Explorer`,
    description: `Latest blocks on ${name}.`,
    url: `/explorer/${network}/${chainSlug}/blocks`,
  });
}

export default async function BlocksPage({ params }: PageProps) {
  const { network } = await params;
  return <BlocksPageClient network={network} />;
}
