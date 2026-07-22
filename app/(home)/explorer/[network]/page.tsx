import { Metadata } from "next";
import { redirect } from "next/navigation";
import { NetworkOverview } from "@/components/explorer-v2/network/NetworkOverview";

export const metadata: Metadata = {
  title: "All Networks | Avalanche Explorer",
  description:
    "Every Avalanche chain on one sheet: live activity, interchain messaging, validators, and AVAX, with search across the whole network.",
  openGraph: {
    title: "All Networks | Avalanche Explorer",
    description:
      "Live activity, interchain messaging, validators, and AVAX across every Avalanche chain.",
  },
};

/* /explorer/{network} — the network scope. Mainnet carries the All Networks
   overview (the aggregate data sources are mainnet-only); other networks
   keep the P-Chain as their front door. */
export default async function ExplorerNetworkHome({
  params,
}: {
  params: Promise<{ network: string }>;
}) {
  const { network } = await params;
  if (network !== "mainnet") redirect(`/explorer/${network}/p-chain`);
  return <NetworkOverview />;
}
