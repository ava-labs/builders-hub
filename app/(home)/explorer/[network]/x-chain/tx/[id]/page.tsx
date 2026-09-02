import { notFound } from "next/navigation";
import { isPchainNetwork } from "@/lib/pchain-explorer";
import { XchainTx } from "@/components/explorer-v2/xchain/XchainPages";

export default async function XchainTxPage({ params }: { params: Promise<{ network: string; id: string }> }) {
  const { network, id } = await params;
  if (!isPchainNetwork(network)) notFound();
  return <XchainTx network={network} txHash={decodeURIComponent(id)} />;
}
