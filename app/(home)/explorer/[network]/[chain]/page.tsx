import { Metadata } from "next";
import l1ChainsData from "@/constants/l1-chains.json";
import { L1Chain } from "@/types/stats";
import { ChainExplorerPageClient } from "./page.client";

interface ChainExplorerPageProps {
  params: Promise<{ network: string; chain: string }>;
}

export async function generateMetadata({ params }: ChainExplorerPageProps): Promise<Metadata> {
  const resolvedParams = await params;
  const { network, chain: chainSlug } = resolvedParams;

  // network-aware, mirroring the layout's resolution (same-slug pairs)
  const wantTestnet = network === "fuji" || network === "testnet";
  const candidates = l1ChainsData.filter((c) => c.slug === chainSlug) as L1Chain[];
  const chain = candidates.find((c) => (c.isTestnet === true) === wantTestnet) ?? candidates[0];
  
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

