import { ReactNode } from "react";
import { redirect } from "next/navigation";
import l1ChainsData from "@/constants/l1-chains.json";
import { isPchainNetwork } from "@/lib/pchain-explorer";

interface NetworkLayoutProps {
  children: ReactNode;
  params: Promise<{ network: string }>;
}

/* The [network] segment is the mainnet | fuji flag every explorer
   route carries. Legacy chain-first URLs (/explorer/{slug}) land here with a
   chain slug in the network position; send them to that chain on mainnet. */
export default async function ExplorerNetworkLayout({ children, params }: NetworkLayoutProps) {
  const { network } = await params;
  if (!isPchainNetwork(network)) {
    const legacy = l1ChainsData.find((c) => c.slug === network);
    // Route to the chain's real network, not a hardcoded mainnet — a legacy
    // single-segment URL for a Fuji chain must not land on its mainnet twin.
    const legacyNetwork =
      legacy && (legacy as { isTestnet?: boolean }).isTestnet ? "fuji" : "mainnet";
    redirect(legacy ? `/explorer/${legacyNetwork}/${network}` : "/explorer");
  }
  return <>{children}</>;
}
