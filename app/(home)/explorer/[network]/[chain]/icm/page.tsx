import { Metadata } from "next";
import l1ChainsData from "@/constants/l1-chains.json";
import { L1Chain } from "@/types/stats";
import { IcmPageClient } from "./page.client";
import { chainCardMetadata } from "@/utils/explorer-metadata";

interface IcmPageProps {
  params: Promise<{ network: string; chain: string }>;
}

export async function generateMetadata({ params }: IcmPageProps): Promise<Metadata> {
  const { network, chain: chainSlug } = await params;
  const chain = l1ChainsData.find((c) => c.slug === chainSlug) as L1Chain | undefined;
  const name = chain?.chainName ?? "Chain";
  return chainCardMetadata({
    chainSlug,
    title: `${name} ICM Messages | Avalanche Explorer`,
    description: `Live Interchain Messaging activity on ${name}.`,
    url: `/explorer/${network}/${chainSlug}/icm`,
  });
}

export default async function IcmPage({ params }: IcmPageProps) {
  const { chain } = await params;
  return <IcmPageClient chainSlug={chain} />;
}
