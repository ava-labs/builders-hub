import { Metadata } from "next";
import { redirect } from "next/navigation";
import { createMetadata } from "@/utils/metadata";
import { NetworkStablecoins } from "@/components/explorer-v2/network/NetworkStablecoins";

const ogImage = { url: "/api/og/explorer", width: 1200, height: 630, alt: "Avalanche Explorer" };

export const metadata: Metadata = createMetadata({
  title: "C-Chain DeFi: Stablecoins | Avalanche Explorer",
  description:
    "C-Chain DeFi stablecoins: market cap over time, dominance, peg health, and the currencies and countries behind them.",
  openGraph: {
    title: "C-Chain DeFi: Stablecoins",
    description:
      "Market cap, dominance, peg health, and the currencies and countries behind every stablecoin on the Avalanche C-Chain.",
    url: "/explorer/mainnet/c-chain/defi/stablecoins",
    images: ogImage,
  },
  twitter: { images: ogImage },
});

/* The C-Chain's DeFi tab, stablecoins view. The aggregates are mainnet
   C-Chain only, so every other chain or network lands on the DeFi tab. */
export default async function ChainDefiStablecoinsPage({
  params,
}: {
  params: Promise<{ network: string; chain: string }>;
}) {
  const { network, chain } = await params;
  if (network !== "mainnet" || chain !== "c-chain") redirect("/explorer/mainnet/c-chain/defi");
  return <NetworkStablecoins />;
}
