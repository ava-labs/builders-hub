import { Metadata } from "next";
import { redirect } from "next/navigation";
import { ChainStakingPageClient } from "./page.client";
import { chainCardMetadata } from "@/utils/explorer-metadata";

interface StakingPageProps {
  params: Promise<{ network: string; chain: string }>;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ network: string; chain: string }>;
}): Promise<Metadata> {
  const { network, chain: chainSlug } = await params;
  return chainCardMetadata({
    chainSlug,
    title: "Avalanche Staking | Avalanche Explorer",
    description:
      "Primary Network staking: total stake and its growth, staking APY, rewards minted, and how the stake distributes across the validator set.",
    url: `/explorer/${network}/${chainSlug}/staking`,
  });
}

/* Staking is a Primary Network instrument — the C-Chain carries it because
   the C-Chain's validators ARE the Primary Network's. Any other chain
   lands on its own validator set instead. */
export default async function ChainStakingPage({ params }: StakingPageProps) {
  const { network, chain } = await params;
  if (chain !== "c-chain") redirect(`/explorer/${network}/${chain}/validators`);
  return <ChainStakingPageClient chainSlug={chain} />;
}
