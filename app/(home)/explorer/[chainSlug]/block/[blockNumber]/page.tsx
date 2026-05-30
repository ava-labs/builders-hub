import { Metadata } from "next";
import l1ChainsData from "@/constants/l1-chains.json";
import { L1Chain } from "@/types/stats";
import { BlockDetailPageClient } from "./page.client";

interface BlockPageProps {
  params: Promise<{ chainSlug: string; blockNumber: string }>;
}

export async function generateMetadata({ params }: BlockPageProps): Promise<Metadata> {
  const resolvedParams = await params;
  const { chainSlug, blockNumber } = resolvedParams;
  
  const chain = l1ChainsData.find((c) => c.slug === chainSlug) as L1Chain | undefined;
  
  if (!chain) {
    return {
      title: `Block #${blockNumber} | Custom Chain Explorer`,
      description: "View block details on Avalanche.",
    };
  }
  
  const title = `Block #${blockNumber} | ${chain.chainName} Explorer`;
  const description = `View details for block #${blockNumber} on ${chain.chainName} - transactions, gas usage, and more.`;
  const url = `/explorer/${chainSlug}/block/${blockNumber}`;
  
  const imageParams = new URLSearchParams();
  imageParams.set("title", title);
  imageParams.set("description", description);
  
  const image = {
    alt: title,
    url: `/api/og/stats/${chainSlug}?${imageParams.toString()}`,
    width: 1280,
    height: 720,
  };
  
  return {
    title,
    description,
    openGraph: { url, images: image },
    twitter: { images: image },
  };
}

export default async function BlockPage({ params }: BlockPageProps) {
  const resolvedParams = await params;
  const { blockNumber } = resolvedParams;
  
  return <BlockDetailPageClient blockNumber={blockNumber} />;
}

