import { Metadata } from "next";
import l1ChainsData from "@/constants/l1-chains.json";
import { L1Chain } from "@/types/stats";
import { ChainValidatorsPageClient } from "./page.client";
import { chainCardMetadata } from "@/utils/explorer-metadata";

interface ValidatorsPageProps {
  params: Promise<{ network: string; chain: string }>;
}

export async function generateMetadata({ params }: ValidatorsPageProps): Promise<Metadata> {
  const { network, chain: chainSlug } = await params;
  const chain = l1ChainsData.find((c) => c.slug === chainSlug) as L1Chain | undefined;
  const name = chain?.chainName ?? "Chain";
  return chainCardMetadata({
    chainSlug,
    title: `${name} Validators | Avalanche Explorer`,
    description: `The validator set securing ${name}: stake, delegators, uptime, and client versions.`,
    url: `/explorer/${network}/${chainSlug}/validators`,
  });
}

export default async function ChainValidatorsPage({ params }: ValidatorsPageProps) {
  const { chain } = await params;
  return <ChainValidatorsPageClient chainSlug={chain} />;
}
