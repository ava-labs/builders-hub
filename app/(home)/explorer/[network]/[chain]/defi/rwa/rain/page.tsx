import { Metadata } from "next";
import { redirect } from "next/navigation";
import { createMetadata } from "@/utils/metadata";
import { DefiRwa } from "@/components/explorer-v2/defi/DefiRwa";

const ogImage = { url: "/api/og/explorer", width: 1200, height: 630, alt: "Avalanche Explorer" };

export const metadata: Metadata = createMetadata({
  title: "C-Chain DeFi: RWA, Rain | Avalanche Explorer",
  description:
    "Real-world assets on the Avalanche C-Chain: the Valinor, Rain and Credit Coop line of credit's capital flow, history and transactions.",
  openGraph: {
    title: "C-Chain DeFi: RWA, Rain",
    description: "The Valinor, Rain and Credit Coop line of credit on the Avalanche C-Chain.",
    url: "/explorer/mainnet/c-chain/defi/rwa/rain",
    images: ogImage,
  },
  twitter: { images: ogImage },
});

/* The C-Chain's DeFi tab, RWA view, Rain's facility. Its line of credit
   lives on mainnet C-Chain only, so every other chain or network lands on
   the DeFi tab. */
export default async function ChainDefiRwaRainPage({
  params,
}: {
  params: Promise<{ network: string; chain: string }>;
}) {
  const { network, chain } = await params;
  if (network !== "mainnet" || chain !== "c-chain") redirect("/explorer/mainnet/c-chain/defi");
  return <DefiRwa slug="rain" />;
}
