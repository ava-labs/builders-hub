import type { Metadata } from "next";
import type { ReactNode } from "react";
import { getExplorerChain, NETWORK_LABEL } from "@/lib/pchain-explorer";
import { createMetadata } from "@/utils/metadata";

// Mirrors the p-chain layout: one metadata source for the whole x-chain
// subtree (blocks, txs, addresses, assets, validators), so none of these
// pages fall back to the site default card.
export async function generateMetadata({
  params,
}: {
  params: Promise<{ network: string }>;
}): Promise<Metadata> {
  const { network } = await params;
  const c = getExplorerChain("x-chain");
  if (!c) return {};
  const net = NETWORK_LABEL[network as keyof typeof NETWORK_LABEL] ?? network;
  const title = `${c.name} Explorer · ${net} | Avalanche`;
  const description = `Explore ${c.name} blocks, transactions, addresses, and assets on ${net}.`;
  const image = { url: "/api/og/explorer", width: 1200, height: 630, alt: title };
  return createMetadata({
    title,
    description,
    openGraph: { title, description, url: `/explorer/${network}/x-chain`, images: image },
    twitter: { images: image },
  });
}

export default function ExplorerXChainLayout({ children }: { children: ReactNode }) {
  return children;
}
