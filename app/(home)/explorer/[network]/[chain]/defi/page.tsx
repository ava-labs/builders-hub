import { Metadata } from "next";
import { redirect } from "next/navigation";
import { createMetadata } from "@/utils/metadata";
import { DefiProtocols } from "@/components/explorer-v2/defi/DefiProtocols";

const ogImage = { url: "/api/og/explorer", width: 1200, height: 630, alt: "Avalanche Explorer" };

export const metadata: Metadata = createMetadata({
  title: "C-Chain DeFi | Avalanche Explorer",
  description:
    "C-Chain DeFi: where the money sits, how DefiLlama counts it, DEX volume, the biggest movers, every protocol, and the best yields.",
  openGraph: {
    title: "C-Chain DeFi",
    description: "Protocol rankings, TVL and on-chain usage on the Avalanche C-Chain.",
    url: "/explorer/mainnet/c-chain/defi",
    images: ogImage,
  },
  twitter: { images: ogImage },
});

/* The C-Chain's DeFi tab, protocols view. The DefiLlama data covers
   mainnet C-Chain only, so every other chain or network lands here. */
export default async function ChainDefiPage({
  params,
}: {
  params: Promise<{ network: string; chain: string }>;
}) {
  const { network, chain } = await params;
  if (network !== "mainnet" || chain !== "c-chain") redirect("/explorer/mainnet/c-chain/defi");
  return <DefiProtocols />;
}
