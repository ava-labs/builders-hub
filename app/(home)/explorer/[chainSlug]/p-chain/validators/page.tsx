import { notFound } from "next/navigation";
import { getExplorerChain } from "@/lib/pchain-explorer";
import { PchainValidators } from "@/components/explorer-v2/pchain/PchainValidators";

export default async function ValidatorsPage({
  params,
}: {
  params: Promise<{ chainSlug: string }>;
}) {
  const { chainSlug: network } = await params;
  const c = getExplorerChain("p-chain");
  if (!c || !c.networks.includes(network)) notFound();
  return <PchainValidators chain={c.slug} network={network} />;
}
