import { Metadata } from "next";
import { notFound } from "next/navigation";
import l1ChainsData from "@/constants/l1-chains.json";
import { L1Chain } from "@/types/stats";
import { GAS_METRICS, isGasMetricKey } from "@/components/explorer/gas-metrics";
import { ChainGasMetricPageClient } from "./page.client";
import { chainCardMetadata } from "@/utils/explorer-metadata";

interface GasMetricPageProps {
  params: Promise<{ network: string; chain: string; metric: string }>;
}

export async function generateMetadata({ params }: GasMetricPageProps): Promise<Metadata> {
  const { network, chain: chainSlug, metric } = await params;
  const chain = l1ChainsData.find((c) => c.slug === chainSlug) as L1Chain | undefined;
  const name = chain?.chainName ?? "Chain";
  const def = isGasMetricKey(metric) ? GAS_METRICS[metric] : undefined;
  return chainCardMetadata({
    chainSlug,
    title: `${name} ${def?.title ?? "Gas"} | Avalanche Explorer`,
    description: def ? `${def.title} on ${name}: ${def.blurb}` : `Gas market detail for ${name}.`,
    url: `/explorer/${network}/${chainSlug}/gas/${metric}`,
  });
}

export default async function ChainGasMetricPage({ params }: GasMetricPageProps) {
  const { chain, metric } = await params;
  if (!isGasMetricKey(metric)) notFound();
  return <ChainGasMetricPageClient chainSlug={chain} metric={metric} />;
}
