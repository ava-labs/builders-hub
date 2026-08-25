import { Metadata } from "next";
import l1ChainsData from "@/constants/l1-chains.json";
import { L1Chain } from "@/types/stats";
import { TxsPageClient } from "./page.client";
import { chainCardMetadata } from "@/utils/explorer-metadata";

interface PageProps {
  params: Promise<{ network: string; chain: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { network, chain: chainSlug } = await params;
  const chain = l1ChainsData.find((c) => c.slug === chainSlug) as L1Chain | undefined;
  const name = chain?.chainName ?? "Chain";
  return chainCardMetadata({
    chainSlug,
    title: `${name} Transactions | Avalanche Explorer`,
    description: `Latest transactions on ${name}.`,
    url: `/explorer/${network}/${chainSlug}/txs`,
  });
}

export default async function TxsPage({ params }: PageProps) {
  const { network } = await params;
  return <TxsPageClient network={network} />;
}
