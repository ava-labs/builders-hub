import { notFound } from "next/navigation";
import { isPchainNetwork } from "@/lib/pchain-explorer";
import { XchainTxsList } from "@/components/explorer-v2/xchain/XchainPages";

export default async function Page({ params }: { params: Promise<{ network: string }> }) {
  const { network } = await params;
  if (!isPchainNetwork(network)) notFound();
  return <XchainTxsList network={network} />;
}
