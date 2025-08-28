import ChainMetricsPage from "@/components/stats/ChainMetricsPage";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Avalanche C-Chain Metrics",
  description: "Track Avalanche C-Chain network activity with real-time metrics including active addresses, transactions, gas usage, fees, and ICM messaging data.",
};

export default function CChainMetrics() {
  return (
    <ChainMetricsPage
      chainId="43114"
      chainName="Avalanche C-Chain"
      description="Real-time insights into Avalanche C-Chain activity and network usage"
    />
  );
}
