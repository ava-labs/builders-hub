import { notFound } from "next/navigation";
import { getExplorerChain } from "@/lib/pchain-explorer";
import { PchainAddress } from "@/components/explorer-v2/pchain/PchainAddress";

export default async function AddressPage({
  params,
}: {
  params: Promise<{ chainSlug: string; addr: string }>;
}) {
  const { chainSlug: network, addr } = await params;
  const c = getExplorerChain("p-chain");
  if (!c || !c.networks.includes(network)) notFound();
  return <PchainAddress chain={c.slug} network={network} addr={decodeURIComponent(addr)} />;
}
