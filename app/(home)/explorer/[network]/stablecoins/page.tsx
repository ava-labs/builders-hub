import { Metadata } from "next";
import { redirect } from "next/navigation";
import { createMetadata } from "@/utils/metadata";
import { NetworkStablecoins } from "@/components/explorer-v2/network/NetworkStablecoins";

const ogImage = { url: "/api/og/explorer", width: 1200, height: 630, alt: "Avalanche Explorer" };

export const metadata: Metadata = createMetadata({
  title: "Stablecoins | Avalanche Explorer",
  description:
    "Every stablecoin on Avalanche: market cap over time, dominance, peg health, and the currencies and countries behind them.",
  openGraph: {
    title: "Stablecoins on Avalanche",
    description:
      "Market cap, dominance, peg health, and the currencies and countries behind every stablecoin on Avalanche.",
    url: "/explorer/mainnet/stablecoins",
    images: ogImage,
  },
  twitter: { images: ogImage },
});

/* The network scope's stablecoin facet. Aggregates are mainnet-only,
   like every other ecosystem-wide surface. */
export default async function NetworkStablecoinsPage({
  params,
}: {
  params: Promise<{ network: string }>;
}) {
  const { network } = await params;
  if (network !== "mainnet") redirect("/explorer/mainnet/stablecoins");
  return <NetworkStablecoins />;
}
