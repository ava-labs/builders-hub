import { Metadata } from "next";
import l1ChainsData from "@/constants/l1-chains.json";
import { L1Chain } from "@/types/stats";
import { QueryPageClient } from "./page.client";
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
    title: `${name} Query | Avalanche Explorer`,
    description: `Ask ${name} a question and get a chart you can audit.`,
    url: `/explorer/${network}/${chainSlug}/query`,
  });
}

export default async function QueryPage({ params }: PageProps) {
  const { network } = await params;
  return <QueryPageClient network={network} />;
}
