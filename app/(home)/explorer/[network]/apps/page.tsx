import { Metadata } from "next";
import { redirect } from "next/navigation";
import { createMetadata } from "@/utils/metadata";
import { NetworkApps } from "@/components/explorer-v2/network/NetworkApps";

const ogImage = { url: "/api/og/explorer", width: 1200, height: 630, alt: "Avalanche Explorer" };

export const metadata: Metadata = createMetadata({
  title: "Apps | Avalanche Explorer",
  description:
    "The applications driving Avalanche: protocol rankings, on-chain usage, gas burned, and per-app analytics.",
  openGraph: {
    title: "Avalanche Apps",
    description: "Protocol rankings and on-chain usage across Avalanche.",
    url: "/explorer/mainnet/apps",
    images: ogImage,
  },
  twitter: { images: ogImage },
});

/* The network scope's app analytics (formerly /stats/dapps). Mainnet-only. */
export default async function NetworkAppsPage({
  params,
}: {
  params: Promise<{ network: string }>;
}) {
  const { network } = await params;
  if (network !== "mainnet") redirect("/explorer/mainnet/apps");
  return <NetworkApps />;
}
