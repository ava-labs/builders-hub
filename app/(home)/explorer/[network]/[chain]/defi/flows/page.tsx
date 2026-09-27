import { Metadata } from "next";
import { redirect } from "next/navigation";
import { createMetadata } from "@/utils/metadata";
import { DefiFlows } from "@/components/explorer-v2/defi/DefiFlows";

const ogImage = { url: "/api/og/explorer", width: 1200, height: 630, alt: "Avalanche Explorer" };

export const metadata: Metadata = createMetadata({
  title: "C-Chain DeFi Flows | Avalanche Explorer",
  description: "Where money moved on the Avalanche C-Chain: flows between wallets and DeFi protocols, net flow by protocol, and the largest moves.",
  openGraph: {
    title: "C-Chain DeFi Flows",
    description: "On-chain flows between wallets and Avalanche DeFi protocols.",
    url: "/explorer/mainnet/c-chain/defi/flows",
    images: ogImage,
  },
  twitter: { images: ogImage },
});

/* The C-Chain's DeFi tab, flows view. The flows are read from the mainnet
   C-Chain index only, so every other chain or network lands on the DeFi tab. */
export default async function ChainDefiFlowsPage({
  params,
}: {
  params: Promise<{ network: string; chain: string }>;
}) {
  const { network, chain } = await params;
  if (network !== "mainnet" || chain !== "c-chain") redirect("/explorer/mainnet/c-chain/defi");
  return <DefiFlows />;
}
