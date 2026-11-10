import { Metadata } from "next";
import { notFound } from "next/navigation";
import { createMetadata } from "@/utils/metadata";
import { NetworkChains } from "@/components/explorer-v2/network/NetworkChains";
import { fetchIndexedChainIds } from "@/lib/stats-coverage";
import { isPchainNetwork } from "@/lib/pchain-explorer";

const ogImage = { url: "/api/og/explorer", width: 1200, height: 630, alt: "Avalanche Explorer" };

const mainnetMetadata: Metadata = createMetadata({
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

const fujiMetadata: Metadata = createMetadata({
  title: "Fuji Chains | Avalanche Explorer",
  description:
    "Every Fuji L1: the network map of validators and ICM between chains, plus each chain's explorer, public RPC, chain ID, and one-click wallet setup.",
  openGraph: {
    title: "Avalanche Fuji Chains",
    description: "Every Fuji L1, its validators, and the ICM between them.",
    url: "/explorer/fuji/chains",
    images: ogImage,
  },
  twitter: { images: ogImage },
});

export async function generateMetadata({ params }: { params: Promise<{ network: string }> }): Promise<Metadata> {
  const { network } = await params;
  return network === "fuji" ? fujiMetadata : mainnetMetadata;
}

/* The network scope's chains tab: the city app, where the network map,
   the figures and the directory are one tool. Mainnet and Fuji each get
   the city of their own chains. */
export default async function NetworkChainsPage({
  params,
}: {
  params: Promise<{ network: string }>;
}) {
  const { network } = await params;
  if (!isPchainNetwork(network)) notFound();
  const indexed = await fetchIndexedChainIds();
  return <NetworkChains indexedChainIds={indexed ? [...indexed] : null} network={network} />;
}
