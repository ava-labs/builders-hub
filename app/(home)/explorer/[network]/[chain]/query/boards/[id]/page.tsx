import type { Metadata } from "next";
import l1ChainsData from "@/constants/l1-chains.json";
import { L1Chain } from "@/types/stats";
import { chainCardMetadata } from "@/utils/explorer-metadata";
import { QueryBoardClient } from "./page.client";

interface PageProps {
  params: Promise<{ network: string; chain: string; id: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { network, chain: chainSlug, id } = await params;
  const chain = l1ChainsData.find((c) => c.slug === chainSlug) as L1Chain | undefined;
  const name = chain?.chainName ?? "Chain";
  return {
    ...chainCardMetadata({
      chainSlug,
      title: `${name} Query board | Avalanche Explorer`,
      description: `A page of ${name} charts built from Query answers.`,
      url: `/explorer/${network}/${chainSlug}/query/boards/${id}`,
    }),
    robots: { index: false },
  };
}

/* one board: a canvas of pinned answers, kept on this device */
export default async function QueryBoardPage({ params }: PageProps) {
  const { network, id } = await params;
  return <QueryBoardClient network={network} id={id} />;
}
