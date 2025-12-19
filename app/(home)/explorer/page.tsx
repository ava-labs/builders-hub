import { Metadata } from "next";
import AllChainsExplorerPage from "@/components/explorer/AllChainsExplorerPage";
import { AllChainsExplorerLayout } from "@/components/explorer/AllChainsExplorerLayout";

export const metadata: Metadata = {
  title: "All Chains Explorer | Avalanche Ecosystem",
  description: "Explore all Avalanche L1 chains in real-time - blocks, transactions, and cross-chain messages across the entire ecosystem.",
  openGraph: {
    title: "All Chains Explorer | Avalanche Ecosystem",
    description: "Explore all Avalanche L1 chains in real-time - blocks, transactions, and cross-chain messages across the entire ecosystem.",
  },
};

export default function ExplorerIndexPage() {
  return (
    <AllChainsExplorerLayout>
      <AllChainsExplorerPage />
    </AllChainsExplorerLayout>
  );
}

