import { notFound } from "next/navigation";
import { getExplorerChain } from "@/lib/pchain-explorer";
import { PchainValidators } from "@/components/explorer-v2/pchain/PchainValidators";

// The primary-network validator set is chain-agnostic (P/X/C share it) —
// the X-chain tab reuses the P-chain view under the X-chain shell.
export default async function Page({ params }: { params: Promise<{ network: string }> }) {
  const { network } = await params;
  const c = getExplorerChain("x-chain");
  if (!c || !c.networks.includes(network)) notFound();
  return <PchainValidators chain="x-chain" network={network} />;
}
