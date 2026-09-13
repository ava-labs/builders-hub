import { Metadata } from "next";
import { resolveCatalogChain } from "@/lib/explorer-catalog";
import { ChainExplorerPageClient } from "./page.client";

interface ChainExplorerPageProps {
  params: Promise<{ network: string; chain: string }>;
}

export async function generateMetadata({ params }: ChainExplorerPageProps): Promise<Metadata> {
  const resolvedParams = await params;
  const { network, chain: chainSlug } = resolvedParams;

  const chain = resolveCatalogChain(network, chainSlug);
  
  // For custom chains, return generic metadata (actual name resolved client-side)
  if (!chain) {
    return {
      title: "Custom Chain Explorer | Avalanche L1",
      description: "Explore blockchain data on Avalanche.",
    };
  }
  
  const title = `${chain.chainName} Explorer`;
  const description = `Explore ${chain.chainName} blockchain - search transactions, blocks, and addresses.`;
  const url = `/explorer/${resolvedParams.network}/${chainSlug}`;
  
  const imageParams = new URLSearchParams();
  imageParams.set("title", title);
  imageParams.set("description", description);
  
  const image = {
    alt: title,
    url: `/api/og/stats/${chainSlug}?${imageParams.toString()}&v=2`,
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

export default async function ChainExplorerPage({ params }: ChainExplorerPageProps) {
  const { network } = await params;

  // Just render the client component - layout handles chain lookup
  return <ChainExplorerPageClient network={network} />;
}

