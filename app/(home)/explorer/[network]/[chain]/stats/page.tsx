import { Metadata } from "next";
import l1ChainsData from "@/constants/l1-chains.json";
import { L1Chain } from "@/types/stats";
import { ChainStatsPageClient } from "./page.client";

interface StatsPageProps {
  params: Promise<{ network: string; chain: string }>;
}

export async function generateMetadata({ params }: StatsPageProps): Promise<Metadata> {
  const { chain: chainSlug } = await params;
  const chain = l1ChainsData.find((c) => c.slug === chainSlug) as L1Chain | undefined;
  const name = chain?.chainName ?? "Chain";
  return {
    title: `${name} Stats | Avalanche Explorer`,
    description: `${name} by the numbers: active addresses, transactions, contracts, gas, fees, and interchain messaging.`,
  };
}

export default async function ChainStatsPage({ params }: StatsPageProps) {
  const { chain } = await params;
  return <ChainStatsPageClient chainSlug={chain} />;
}
