import { Metadata } from "next";
import l1ChainsData from "@/constants/l1-chains.json";
import { L1Chain } from "@/types/stats";
import { QueryPageClient } from "./page.client";
import { chainCardMetadata } from "@/utils/explorer-metadata";
import { queryTarget } from "@/lib/explorer-query/target";
import { answerMetadata } from "@/lib/explorer-query/share-answer";
import { indexState } from "@/lib/explorer-query/clickhouse";

interface PageProps {
  params: Promise<{ network: string; chain: string }>;
  searchParams: Promise<{ q?: string | string[]; then?: string | string[] }>;
}

export async function generateMetadata({ params, searchParams }: PageProps): Promise<Metadata> {
  const { network, chain: chainSlug } = await params;
  // a link to an answer (?q=) is named by the answer: its title, its note and its own share image
  const { q, then } = await searchParams;
  const shared = await answerMetadata({ network, slug: chainSlug, q, then, path: `/explorer/${network}/${chainSlug}/query` });
  if (shared) return shared;
  const chain = l1ChainsData.find((c) => c.slug === chainSlug) as L1Chain | undefined;
  const name = chain?.chainName ?? "Chain";
  return chainCardMetadata({
    chainSlug,
    title: `${name} Query | Avalanche Explorer`,
    description: `Ask ${name} a question and get a chart you can audit.`,
    url: `/explorer/${network}/${chainSlug}/query`,
  });
}

export default async function QueryPage({ params }: PageProps) {
  const { network, chain: chainSlug } = await params;
  // whether the database holds this chain, read once an hour; the page says so when it does not.
  // Streamed, not awaited: the page goes out at once and the read follows it
  const target = queryTarget(network, chainSlug);
  const index = target ? indexState(target.chainId) : null;
  return <QueryPageClient network={network} index={index} />;
}
