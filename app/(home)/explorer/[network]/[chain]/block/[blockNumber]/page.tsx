import { Metadata } from "next";
import l1ChainsData from "@/constants/l1-chains.json";
import { L1Chain } from "@/types/stats";
import { BlockDetailPageClient } from "./page.client";

interface BlockPageProps {
  params: Promise<{ network: string; chain: string; blockNumber: string }>;
}

export async function generateMetadata({ params }: BlockPageProps): Promise<Metadata> {
  const resolvedParams = await params;
  const { chain: chainSlug, blockNumber } = resolvedParams;
  
  const chain = l1ChainsData.find((c) => c.slug === chainSlug) as L1Chain | undefined;
  
  if (!chain) {
    return {
      title: `Block #${blockNumber} | Custom Chain Explorer`,
      description: "View block details on Avalanche.",
    };
  }
  
  const title = `Block #${blockNumber} | ${chain.chainName} Explorer`;
  const description = `View details for block #${blockNumber} on ${chain.chainName} - transactions, gas usage, and more.`;
  const url = `/explorer/${resolvedParams.network}/${chainSlug}/block/${blockNumber}`;
  
  // Live data card: tx count, gas used, and time fetched at scrape time.
  const image = {
    alt: title,
    url: `/api/og/block/${resolvedParams.network}/${chainSlug}/${blockNumber}`,
    width: 1200,
    height: 630,
  };
  
  return {
    title,
    description,
    openGraph: { url, images: image },
    twitter: { images: image },
  };
}

export default async function BlockPage({ params }: BlockPageProps) {
  const { network, blockNumber } = await params;

  return <BlockDetailPageClient network={network} blockNumber={blockNumber} />;
}

