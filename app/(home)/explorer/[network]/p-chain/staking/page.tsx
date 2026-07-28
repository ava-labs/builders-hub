import { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getExplorerChain } from "@/lib/pchain-explorer";
import { PchainStaking } from "@/components/explorer-v2/pchain/PchainValidators";

export const metadata: Metadata = {
  title: "Avalanche Staking | Avalanche Explorer",
  description:
    "Primary Network staking: total stake and its growth, staking APY, rewards minted and paid, stake unlocks, and how the stake distributes across the validator set.",
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
