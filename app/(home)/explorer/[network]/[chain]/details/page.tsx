import { Metadata } from "next";
import l1ChainsData from "@/constants/l1-chains.json";
import { L1Chain } from "@/types/stats";
import { ChainDetailsPageClient } from "./page.client";
import { chainCardMetadata } from "@/utils/explorer-metadata";

interface DetailsPageProps {
  params: Promise<{ network: string; chain: string }>;
}

export async function generateMetadata({ params }: DetailsPageProps): Promise<Metadata> {
  const { network, chain: chainSlug } = await params;
  const chain = l1ChainsData.find((c) => c.slug === chainSlug) as L1Chain | undefined;
  const name = chain?.chainName ?? "Chain";
  return chainCardMetadata({
    chainSlug,
    title: `${name} Details | Avalanche Explorer`,
    description: `${name} on-chain record: identifiers, subnet, validator set, and wallet setup.`,
    url: `/explorer/${network}/${chainSlug}/details`,
  });
}

export default async function ChainDetailsPage({ params }: DetailsPageProps) {
  const { chain } = await params;
  return <ChainDetailsPageClient chainSlug={chain} />;
}
