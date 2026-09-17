import { Metadata } from "next";
import { createMetadata } from "@/utils/metadata";
import ExplorerPortal from "@/components/explorer-v2/ExplorerPortal";

const ogImage = { url: "/api/og/explorer", width: 1200, height: 630, alt: "Avalanche Explorer" };

export const metadata: Metadata = createMetadata({
  title: "Explorer | Avalanche Builder Hub",
  description:
    "One front door for every Avalanche chain: search any block, transaction, address, or node, and open the P-Chain, C-Chain, or any L1's explorer.",
  openGraph: {
    title: "Avalanche Explorer",
    description:
      "Search any block, transaction, address, or node across Avalanche, live.",
    url: "/explorer",
    images: ogImage,
  },
  twitter: { images: ogImage },
});

/* /explorer — the portal into every chain's explorer. */
export default function ExplorerHome() {
  return <ExplorerPortal />;
}
