import { Metadata } from "next";
import { notFound } from "next/navigation";
import l1ChainsData from "@/constants/l1-chains.json";
import { L1Chain } from "@/types/stats";
import { ChainExplorerPageClient } from "./page.client";

interface ChainExplorerPageProps {
  params: Promise<{ chainSlug: string }>;
}

export async function generateMetadata({ params }: ChainExplorerPageProps): Promise<Metadata> {
  const resolvedParams = await params;
  const { chainSlug } = resolvedParams;
  
  const chain = l1ChainsData.find((c) => c.slug === chainSlug) as L1Chain | undefined;
  
  // For custom chains, return generic metadata (actual name resolved client-side)
  if (!chain) {
    return {
      title: "Custom Chain Explorer | Avalanche L1",
      description: "Explore blockchain data on Avalanche.",
    };
  }
  
  const title = `${chain.chainName} Explorer`;
  const description = `Explore ${chain.chainName} blockchain - search transactions, blocks, and addresses.`;
  const url = `/explorer/${chainSlug}`;
  
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

export default async function ChainExplorerPage({ params }: ChainExplorerPageProps) {
  const resolvedParams = await params;
  const { chainSlug } = resolvedParams;
  
  // Just render the client component - layout handles chain lookup
  return <ChainExplorerPageClient chainSlug={chainSlug} />;
}

