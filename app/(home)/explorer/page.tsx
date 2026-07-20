import { Metadata } from "next";
import ExplorerPortal from "@/components/explorer-v2/ExplorerPortal";

export const metadata: Metadata = {
  title: "Explorer | Avalanche Builder Hub",
  description:
    "One front door for every Avalanche chain: search any block, transaction, address, or node, and open the P-Chain, C-Chain, or any L1's explorer.",
  openGraph: {
    title: "Avalanche Explorer",
    description:
      "Search any block, transaction, address, or node across Avalanche, live.",
  },
};

/* /explorer — the portal into every chain's explorer. */
export default function ExplorerHome() {
  return <ExplorerPortal />;
}
