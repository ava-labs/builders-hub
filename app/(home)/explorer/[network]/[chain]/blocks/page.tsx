import { Metadata } from "next";
import l1ChainsData from "@/constants/l1-chains.json";
import { L1Chain } from "@/types/stats";
import { BlocksPageClient } from "./page.client";

interface PageProps {
  params: Promise<{ network: string; chain: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { chain: chainSlug } = await params;
  const chain = l1ChainsData.find((c) => c.slug === chainSlug) as L1Chain | undefined;
  return { title: `${chain?.chainName ?? "Chain"} Blocks | Avalanche Explorer` };
}

export default async function BlocksPage({ params }: PageProps) {
  const { chain } = await params;
  return <BlocksPageClient chainSlug={chain} />;
}
