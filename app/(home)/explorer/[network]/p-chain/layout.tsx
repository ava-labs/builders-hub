import type { Metadata } from "next";
import type { ReactNode } from "react";
import { getExplorerChain, NETWORK_LABEL } from "@/lib/pchain-explorer";
import { createMetadata } from "@/utils/metadata";

export async function generateMetadata({
  params,
}: {
  // /explorer/{network}/p-chain — [network] carries the network.
  params: Promise<{ network: string }>;
}): Promise<Metadata> {
  const { network } = await params;
  const c = getExplorerChain("p-chain");
  if (!c) return {};
  const net = NETWORK_LABEL[network as keyof typeof NETWORK_LABEL] ?? network;
  const title = `${c.name} Explorer · ${net} | Avalanche`;
  const description = `Explore ${c.name} blocks, transactions, addresses, validators, and staking on ${net}.`;
  const image = { url: "/api/og/explorer", width: 1200, height: 630, alt: title };
  return createMetadata({
    title,
    description,
    openGraph: { title, description, url: `/explorer/${network}/p-chain`, images: image },
    twitter: { images: image },
  });
}

export default function ExplorerNetworkLayout({ children }: { children: ReactNode }) {
  return children;
}
