import { Metadata } from "next";
import l1ChainsData from "@/constants/l1-chains.json";
import { L1Chain } from "@/types/stats";
import { chainCardMetadata } from "@/utils/explorer-metadata";
import { AccountsPageClient } from "./page.client";

interface PageProps {
  params: Promise<{ network: string; chain: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { network, chain: chainSlug } = await params;
  const chain = l1ChainsData.find((c) => c.slug === chainSlug) as L1Chain | undefined;
  const name = chain?.chainName ?? "Chain";
  return chainCardMetadata({
    chainSlug,
    title: `${name} Accounts | Avalanche Explorer`,
    description: `Who is on ${name}: active and total addresses, contracts deployed, the most-called addresses, and the busiest senders.`,
    url: `/explorer/${network}/${chainSlug}/accounts`,
  });
}

export default async function AccountsPage({ params }: PageProps) {
  const { network } = await params;
  return <AccountsPageClient network={network} />;
}
