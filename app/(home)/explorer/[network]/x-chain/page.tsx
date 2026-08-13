import { notFound } from "next/navigation";
import { isPchainNetwork } from "@/lib/pchain-explorer";
import { XchainHome } from "@/components/explorer-v2/xchain/XchainPages";

export default async function XchainHomePage({ params }: { params: Promise<{ network: string }> }) {
  const { network } = await params;
  if (!isPchainNetwork(network)) notFound();
  return <XchainHome network={network} />;
}
