import { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getExplorerChain } from "@/lib/pchain-explorer";
import {
  STAKING_METRICS,
  isStakingMetricKey,
} from "@/components/explorer-v2/staking/staking-metrics";
import { PchainStakingMetricPageClient } from "./page.client";

interface PageProps {
  params: Promise<{ network: string; metric: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { metric } = await params;
  const def = isStakingMetricKey(metric) ? STAKING_METRICS[metric] : undefined;
  return {
    title: `${def?.title ?? "Staking"} | Avalanche Explorer`,
    description: def
      ? `Primary Network ${def.title.toLowerCase()}: ${def.blurb}`
      : "Primary Network staking detail.",
  };
}

/* Same guard as the P-Chain staking tab: mainnet only. */
export default async function PchainStakingMetricPage({ params }: PageProps) {
  const { network, metric } = await params;
  const c = getExplorerChain("p-chain");
  if (!c || !c.networks.includes(network)) notFound();
  if (network !== "mainnet") redirect(`/explorer/${network}/p-chain/validators`);
  if (!isStakingMetricKey(metric)) notFound();
  return <PchainStakingMetricPageClient network={network} metric={metric} />;
}
