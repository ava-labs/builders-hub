import { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getExplorerChain } from "@/lib/pchain-explorer";
import { PchainL1s } from "@/components/explorer-v2/staking/L1Economy";

export const metadata: Metadata = {
  title: "Avalanche L1s | Avalanche Explorer",
  description:
    "The ACP-77 L1 validator economy: active fee-paying seats, the live continuous-fee price and what the whole set burns, Primary-vs-L1 seat growth, and where the seats run.",
};

export default async function L1sPage({
  params,
}: {
  params: Promise<{ network: string }>;
}) {
  const { network } = await params;
  const c = getExplorerChain("p-chain");
  if (!c || !c.networks.includes(network)) notFound();
  // the seat-economy feeds (ecosystem seats, metrics) watch mainnet only
  if (network !== "mainnet") redirect(`/explorer/${network}/p-chain/validators`);
  return <PchainL1s chain={c.slug} network={network} />;
}
