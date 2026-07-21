import type { Metadata } from "next";
import type { ReactNode } from "react";
import { getExplorerChain, NETWORK_LABEL } from "@/lib/pchain-explorer";

export async function generateMetadata({
  params,
}: {
  // /explorer/{network}/p-chain — [chainSlug] carries the network.
  params: Promise<{ chainSlug: string }>;
}): Promise<Metadata> {
  const { chainSlug: network } = await params;
  const c = getExplorerChain("p-chain");
  if (!c) return {};
  const net = NETWORK_LABEL[network as keyof typeof NETWORK_LABEL] ?? network;
  const title = `${c.name} Explorer · ${net} | Avalanche`;
  const description = `Explore ${c.name} blocks, transactions, addresses, validators, and staking on ${net}.`;
  return { title, description, openGraph: { title, description } };
}

export default function ExplorerNetworkLayout({ children }: { children: ReactNode }) {
  return children;
}
