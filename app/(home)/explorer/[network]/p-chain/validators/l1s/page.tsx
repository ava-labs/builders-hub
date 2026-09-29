import { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getExplorerChain } from "@/lib/pchain-explorer";
import { PchainL1Validators } from "@/components/explorer-v2/pchain/PchainValidators";

export const metadata: Metadata = {
  title: "L1 Validators | Avalanche Explorer",
  description:
    "Every Avalanche L1's validators: AvalancheGo versions against the required release, the balance that pays each validator's continuous fee, and the network crawler's last handshake.",
};

export default async function L1ValidatorsPage({
  params,
}: {
  params: Promise<{ network: string }>;
}) {
  const { network } = await params;
  const c = getExplorerChain("p-chain");
  if (!c || !c.networks.includes(network)) notFound();
  // the L1 list and its versions are read for mainnet only
  if (network !== "mainnet") redirect(`/explorer/${network}/p-chain/validators`);
  return <PchainL1Validators chain={c.slug} network={network} />;
}
