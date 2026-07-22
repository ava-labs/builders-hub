import { ReactNode } from "react";
import { notFound } from "next/navigation";
import l1ChainsData from "@/constants/l1-chains.json";
import { L1Chain } from "@/types/stats";
import { ChainExplorerLayoutClient } from "./layout.client";

interface ChainExplorerLayoutProps {
  children: ReactNode;
  params: Promise<{ network: string; chain: string }>;
}

export default async function ChainExplorerLayout({
  children,
  params
}: ChainExplorerLayoutProps) {
  const resolvedParams = await params;
  const { network, chain: chainSlug } = resolvedParams;

  // Find chain in static data — network-aware: the catalog holds same-slug
  // pairs (mainnet + Fuji deployments of one chain), and the URL's network
  // segment picks between them. A chain with a single entry answers under
  // either segment, so old links keep working.
  const wantTestnet = network === "fuji" || network === "testnet";
  const candidates = l1ChainsData.filter((c) => c.slug === chainSlug) as L1Chain[];
  const chain = candidates.find((c) => (c.isTestnet === true) === wantTestnet) ?? candidates[0];
  
  // If chain found in static data, render with server-known props
  if (chain) {
    return (
      <ChainExplorerLayoutClient
        chainId={chain.chainId}
        chainName={chain.chainName}
        chainSlug={chain.slug}
        themeColor={chain.color || "#E57373"}
        chainLogoURI={chain.chainLogoURI}
        nativeToken={chain.networkToken?.symbol}
        description={chain.description}
        website={chain.website}
        socials={chain.socials}
        rpcUrl={chain.rpcUrl}
        blockchainId={chain.blockchainId}
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

