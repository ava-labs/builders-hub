import { Metadata } from "next";
import { Suspense } from "react";
import { createMetadata } from "@/utils/metadata";
import { NetworkStats } from "@/components/explorer-v2/network/NetworkStats";

const ogImage = { url: "/api/og/explorer", width: 1200, height: 630, alt: "Avalanche Explorer" };

export const metadata: Metadata = createMetadata({
  title: "Stats | Avalanche Explorer",
  description: "Track aggregated L1 activity across all Avalanche chains with real-time metrics including active addresses, transactions, gas usage, fees, and network performance data.",
  openGraph: {
    title: "Avalanche Stats — All Networks",
    description: "Track aggregated L1 activity across all Avalanche chains with real-time metrics including active addresses, transactions, gas usage, fees, and network performance data.",
    url: "/stats/network-metrics",
    images: ogImage,
  },
  twitter: { images: ogImage },
});

export default function AllChainsStatsPage() {
  return (
    <Suspense fallback={<div className="min-h-screen" />}>
      <NetworkStats />
    </Suspense>
  );
}

