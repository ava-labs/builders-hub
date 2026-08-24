import { Metadata } from "next";
import { redirect } from "next/navigation";
import { createMetadata } from "@/utils/metadata";
import { NetworkIcm } from "@/components/explorer-v2/network/NetworkIcm";

const ogImage = { url: "/api/og/explorer", width: 1200, height: 630, alt: "Avalanche Explorer" };

export const metadata: Metadata = createMetadata({
  title: "Interchain Messaging | Avalanche Explorer",
  description:
    "ICM across the whole Avalanche network: message volume, the busiest chains and routes, and token transfer (ICTT) analytics.",
  openGraph: {
    title: "Avalanche Interchain Messaging",
    description: "Network-wide ICM volume, top chains, and ICTT analytics.",
    url: "/explorer/mainnet/icm",
    images: ogImage,
  },
  twitter: { images: ogImage },
});

/* The network scope's aggregate ICM view; per-chain message feeds live at
   /explorer/{network}/{chain}/icm. Aggregates are mainnet-only. */
export default async function NetworkIcmPage({
  params,
}: {
  params: Promise<{ network: string }>;
}) {
  const { network } = await params;
  if (network !== "mainnet") redirect("/explorer/mainnet/icm");
  return <NetworkIcm />;
}
