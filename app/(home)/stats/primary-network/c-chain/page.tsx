import ChainMetricsPage from "@/components/stats/ChainMetricsPage";
import { Metadata } from "next";
import { createMetadata } from "@/utils/metadata";

export const metadata: Metadata = createMetadata({
  title: "Avalanche C-Chain Metrics",
  description:
    "Track Avalanche C-Chain network activity with real-time metrics including active addresses, transactions, gas usage, fees, and Interchain Messaging data.",
  openGraph: {
    url: "/stats/primary-network/c-chain",
    images: {
      alt: "Avalanche C-Chain Metrics",
      url: "/api/og/stats/c-chain?title=Avalanche C-Chain Metrics&description=Track Avalanche C-Chain network activity with real-time metrics including active addresses, transactions, gas usage, fees, and Interchain Messaging data.",
      width: 1280,
      height: 720,
    },
  },
  twitter: {
    images: {
      alt: "Avalanche C-Chain Metrics",
      url: "/api/og/stats/c-chain?title=Avalanche C-Chain Metrics&description=Track Avalanche C-Chain network activity with real-time metrics including active addresses, transactions, gas usage, fees, and Interchain Messaging data.",
      width: 1280,
      height: 720,
    },
  },
});

export default function CChainMetrics() {
  return (
    <ChainMetricsPage
      chainId="43114"
      chainName="Avalanche C-Chain"
      description="Real-time insights into Avalanche C-Chain activity and network usage"
    />
  );
}
