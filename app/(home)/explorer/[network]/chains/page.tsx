import { Metadata } from "next";
import { redirect } from "next/navigation";
import { createMetadata } from "@/utils/metadata";
import { NetworkChains } from "@/components/explorer-v2/network/NetworkChains";

const ogImage = { url: "/api/og/explorer", width: 1200, height: 630, alt: "Avalanche Explorer" };

export const metadata: Metadata = createMetadata({
  title: "Chains | Avalanche Explorer",
  description:
    "The Avalanche chain directory: every L1's explorer, public RPC, chain ID, and one-click wallet setup.",
  openGraph: {
    title: "Avalanche Chains",
    description: "Every Avalanche chain: explorers, public RPCs, and wallet setup.",
    url: "/explorer/mainnet/chains",
    images: ogImage,
  },
  twitter: { images: ogImage },
});

/* The network scope's chain directory. The directory itself carries a
   mainnet/Fuji filter, so other network segments just normalize here. */
export default async function NetworkChainsPage({
  params,
}: {
  params: Promise<{ network: string }>;
}) {
  const { network } = await params;
  if (network !== "mainnet") redirect("/explorer/mainnet/chains");
  return <NetworkChains />;
}
