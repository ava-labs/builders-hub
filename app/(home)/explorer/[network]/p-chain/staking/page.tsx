import { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getExplorerChain } from "@/lib/pchain-explorer";
import { PchainStaking } from "@/components/explorer-v2/pchain/PchainValidators";

export const metadata: Metadata = {
  title: "Avalanche Staking | Avalanche Explorer",
  description:
    "The Avalanche validator economy: Primary Network stake, APY and rewards, stake unlocks, and the ACP-77 L1 seat market — seats, continuous fees, and where they run.",
};

export default async function StakingPage({
  params,
}: {
  params: Promise<{ network: string }>;
}) {
  const { network } = await params;
  const c = getExplorerChain("p-chain");
  if (!c || !c.networks.includes(network)) notFound();
  // the staking feeds watch mainnet; Fuji has no observatory to show
  if (network !== "mainnet") redirect(`/explorer/${network}/p-chain/validators`);
  return <PchainStaking chain={c.slug} network={network} />;
}
