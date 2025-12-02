import { ReactNode } from "react";
import { notFound } from "next/navigation";
import l1ChainsData from "@/constants/l1-chains.json";
import { L1Chain } from "@/types/stats";
import { ChainExplorerLayoutClient } from "./layout.client";

interface ChainExplorerLayoutProps {
  children: ReactNode;
  params: Promise<{ chainSlug: string }>;
}

export default async function ChainExplorerLayout({ 
  children, 
  params 
}: ChainExplorerLayoutProps) {
  const resolvedParams = await params;
  const { chainSlug } = resolvedParams;
  
  // Find chain in static data
  const chain = l1ChainsData.find((c) => c.slug === chainSlug) as L1Chain | undefined;
  
  // If chain found in static data, render with server-known props
  if (chain) {
    return (
      <ChainExplorerLayoutClient
        chainId={chain.chainId}
        chainName={chain.chainName}
        chainSlug={chain.slug}
        themeColor={chain.color || "#E57373"}
        chainLogoURI={chain.chainLogoURI}
        nativeToken={chain.tokenSymbol}
        description={chain.description}
        website={chain.website}
        socials={chain.socials}
        rpcUrl={chain.rpcUrl}
        sourcifySupport={(chain as L1Chain & { sourcifySupport?: boolean }).sourcifySupport}
      >
        {children}
      </ChainExplorerLayoutClient>
    );
  }
  
  // For custom chains (not in static data), render client-side loader
  // The client component will look up the chain from localStorage
  return (
    <ChainExplorerLayoutClient chainSlug={chainSlug} isCustomChain>
      {children}
    </ChainExplorerLayoutClient>
  );
}

