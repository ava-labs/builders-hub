import { Metadata } from "next";
import { redirect } from "next/navigation";
import { createMetadata } from "@/utils/metadata";
import { DefiRwa } from "@/components/explorer-v2/defi/DefiRwa";

const ogImage = { url: "/api/og/explorer", width: 1200, height: 630, alt: "Avalanche Explorer" };

export const metadata: Metadata = createMetadata({
  title: "C-Chain DeFi: RWA | Avalanche Explorer",
  description:
    "Real-world assets on the Avalanche C-Chain: the Valinor, OatFi and Fence pilot's capital flow, facility performance, history and transactions.",
  openGraph: {
    title: "C-Chain DeFi: RWA",
    description: "The Valinor, OatFi and Fence real-world asset lending pilot on the Avalanche C-Chain.",
    url: "/explorer/mainnet/c-chain/defi/rwa",
    images: ogImage,
  },
  twitter: { images: ogImage },
});

/* The C-Chain's DeFi tab, RWA view. The pilot's pool lives on mainnet
   C-Chain only, so every other chain or network lands on the DeFi tab. */
export default async function ChainDefiRwaPage({
  params,
}: {
  params: Promise<{ network: string; chain: string }>;
}) {
  const { network, chain } = await params;
  if (network !== "mainnet" || chain !== "c-chain") redirect("/explorer/mainnet/c-chain/defi");
  return <DefiRwa />;
}
