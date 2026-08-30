import { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import {
  STAKING_METRICS,
  isStakingMetricKey,
} from "@/components/explorer-v2/staking/staking-metrics";
import { ChainStakingMetricPageClient } from "./page.client";
import { chainCardMetadata } from "@/utils/explorer-metadata";

interface StakingMetricPageProps {
  params: Promise<{ network: string; chain: string; metric: string }>;
}

export async function generateMetadata({ params }: StakingMetricPageProps): Promise<Metadata> {
  const { network, chain: chainSlug, metric } = await params;
  const def = isStakingMetricKey(metric) ? STAKING_METRICS[metric] : undefined;
  return chainCardMetadata({
    chainSlug,
    title: `${def?.title ?? "Staking"} | Avalanche Explorer`,
    description: def
      ? `Primary Network ${def.title.toLowerCase()}: ${def.blurb}`
      : "Primary Network staking detail.",
    url: `/explorer/${network}/${chainSlug}/staking/${metric}`,
  });
}

/* Same guard as the staking tab: this is a Primary Network instrument,
   carried by the C-Chain. */
export default async function ChainStakingMetricPage({ params }: StakingMetricPageProps) {
  const { network, chain, metric } = await params;
  if (chain !== "c-chain") redirect(`/explorer/${network}/${chain}/validators`);
  if (!isStakingMetricKey(metric)) notFound();
  return <ChainStakingMetricPageClient chainSlug={chain} network={network} metric={metric} />;
}
