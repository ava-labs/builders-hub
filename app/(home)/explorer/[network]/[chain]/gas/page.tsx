import { Metadata } from "next";
import l1ChainsData from "@/constants/l1-chains.json";
import { L1Chain } from "@/types/stats";
import { ChainGasPageClient } from "./page.client";
import { chainCardMetadata } from "@/utils/explorer-metadata";

interface GasPageProps {
  params: Promise<{ network: string; chain: string }>;
}

export async function generateMetadata({ params }: GasPageProps): Promise<Metadata> {
  const { network, chain: chainSlug } = await params;
  const chain = l1ChainsData.find((c) => c.slug === chainSlug) as L1Chain | undefined;
  const name = chain?.chainName ?? "Chain";
  return chainCardMetadata({
    chainSlug,
    title: `${name} Gas | Avalanche Explorer`,
    description: `${name} gas market: live base fee and utilization, fee history, and the contracts consuming the most gas.`,
    url: `/explorer/${network}/${chainSlug}/gas`,
  });
}

export default async function ChainGasPage({ params }: GasPageProps) {
  const { chain } = await params;
  return <ChainGasPageClient chainSlug={chain} />;
}
