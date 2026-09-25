import { Metadata } from "next";
import { redirect } from "next/navigation";
import { createMetadata } from "@/utils/metadata";
import { NetworkChains } from "@/components/explorer-v2/network/NetworkChains";
import { fetchIndexedChainIds } from "@/lib/stats-coverage";

const ogImage = { url: "/api/og/explorer", width: 1200, height: 630, alt: "Avalanche Explorer" };

export const metadata: Metadata = createMetadata({
  title: "Chains | Avalanche Explorer",
  description:
    "Every Avalanche L1: the network map of validators and ICM between chains, plus each chain's explorer, public RPC, chain ID, and one-click wallet setup.",
  openGraph: {
    title: "Avalanche Chains",
    description: "Every Avalanche L1, its validators, and the ICM between them.",
    url: "/explorer/mainnet/chains",
    images: ogImage,
  },
  twitter: { images: ogImage },
});

/* The network scope's chains tab: figures, the network map, and the
   directory. The directory carries a mainnet/Fuji filter, so other network
   segments just normalize here. */
export default async function NetworkChainsPage({
  params,
}: {
  params: Promise<{ network: string }>;
}) {
  const { network } = await params;
  if (network !== "mainnet") redirect("/explorer/mainnet/chains");
  const indexed = await fetchIndexedChainIds();
  return <NetworkChains indexedChainIds={indexed ? [...indexed] : null} />;
}
