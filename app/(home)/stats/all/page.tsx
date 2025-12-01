import { Metadata } from "next";
import ChainMetricsPage from "@/components/stats/ChainMetricsPage";

export const metadata: Metadata = {
  title: "All Chains Stats | Avalanche Ecosystem",
  description: "Track aggregated L1 activity across all Avalanche chains with real-time metrics including active addresses, transactions, gas usage, fees, and network performance data.",
  openGraph: {
    title: "All Chains Stats | Avalanche Ecosystem",
    description: "Track aggregated L1 activity across all Avalanche chains with real-time metrics including active addresses, transactions, gas usage, fees, and network performance data.",
    url: "/stats/all",
  },
};

export default function AllChainsStatsPage() {
  return (
    <ChainMetricsPage
      chainId="all"
      chainName="All Chains"
      chainSlug="all"
      description="Aggregated metrics and analytics across all Avalanche L1 chains"
      themeColor="#E84142"
    />
  );
}

