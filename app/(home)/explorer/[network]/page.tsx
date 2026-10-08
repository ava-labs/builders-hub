import { Metadata } from "next";
import { notFound } from "next/navigation";
import { createMetadata } from "@/utils/metadata";
import { NetworkOverview } from "@/components/explorer-v2/network/NetworkOverview";
import { ViewSwitchFade } from "@/components/explorer-v2/view-switch";
import { isPchainNetwork } from "@/lib/pchain-explorer";

const ogImage = { url: "/api/og/explorer", width: 1200, height: 630, alt: "Avalanche Explorer" };

const mainnetMetadata: Metadata = createMetadata({
  title: "All Networks | Avalanche Explorer",
  description:
    "Every Avalanche chain on one sheet: live activity, interchain messaging, validators, and AVAX, with search across the whole network.",
  openGraph: {
    title: "All Networks | Avalanche Explorer",
    description:
      "Live activity, interchain messaging, validators, and AVAX across every Avalanche chain.",
    url: "/explorer/mainnet",
    images: ogImage,
  },
  twitter: { images: ogImage },
});

const fujiMetadata: Metadata = createMetadata({
  title: "Fuji All Networks | Avalanche Explorer",
  description:
    "Every Fuji chain on one sheet: live activity, interchain messaging, and validators, with search across the whole testnet.",
  openGraph: {
    title: "Fuji All Networks | Avalanche Explorer",
    description: "Live activity, interchain messaging, and validators across every Fuji chain.",
    url: "/explorer/fuji",
    images: ogImage,
  },
  twitter: { images: ogImage },
});

export async function generateMetadata({ params }: { params: Promise<{ network: string }> }): Promise<Metadata> {
  const { network } = await params;
  return network === "fuji" ? fujiMetadata : mainnetMetadata;
}

/* /explorer/{network}: the network scope. Mainnet and Fuji each carry
   the All Networks overview of their own chains. The layout sends every
   other segment away. */
export default async function ExplorerNetworkHome({
  params,
}: {
  params: Promise<{ network: string }>;
}) {
  const { network } = await params;
  if (!isPchainNetwork(network)) notFound();
  return (
    <ViewSwitchFade>
      <NetworkOverview network={network} />
    </ViewSwitchFade>
  );
}
