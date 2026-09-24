import type { Metadata } from "next";
import l1ChainsData from "@/constants/l1-chains.json";
import { L1Chain } from "@/types/stats";
import { chainCardMetadata } from "@/utils/explorer-metadata";
import { QueryBoardsClient } from "./page.client";

interface PageProps {
  params: Promise<{ network: string; chain: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { network, chain: chainSlug } = await params;
  const chain = l1ChainsData.find((c) => c.slug === chainSlug) as L1Chain | undefined;
  const name = chain?.chainName ?? "Chain";
  return {
    ...chainCardMetadata({
      chainSlug,
      title: `${name} Query boards | Avalanche Explorer`,
      description: `Pages of ${name} charts built from Query answers.`,
      url: `/explorer/${network}/${chainSlug}/query/boards`,
    }),
    // boards are kept per device; there is nothing here for a crawler
    robots: { index: false },
  };
}

/* the boards this device built on the chain */
export default async function QueryBoardsPage({ params }: PageProps) {
  const { network } = await params;
  return <QueryBoardsClient network={network} />;
}
