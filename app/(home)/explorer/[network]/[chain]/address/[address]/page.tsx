import { Metadata } from "next";
import l1ChainsData from "@/constants/l1-chains.json";
import { L1Chain } from "@/types/stats";
import { AddressDetailPageClient } from "./page.client";

interface AddressPageProps {
  params: Promise<{ network: string; chain: string; address: string }>;
}

export async function generateMetadata({ params }: AddressPageProps): Promise<Metadata> {
  const resolvedParams = await params;
  const { chain: chainSlug, address } = resolvedParams;
  
  const chain = l1ChainsData.find((c) => c.slug === chainSlug) as L1Chain | undefined;
  const shortAddress = `${address.slice(0, 10)}...${address.slice(-8)}`;
  
  if (!chain) {
    return {
      title: `Address ${shortAddress} | Custom Chain Explorer`,
      description: "View address details on Avalanche.",
    };
  }
  
  const title = `Address ${shortAddress} | ${chain.chainName} Explorer`;
  const description = `View address details on ${chain.chainName} - balance, tokens, transactions, and more.`;
  const url = `/explorer/${resolvedParams.network}/${chainSlug}/address/${address}`;
  
  // Live data card: balance, type, and activity fetched at scrape time.
  const image = {
    alt: title,
    url: `/api/og/address/${resolvedParams.network}/${chainSlug}/${address}`,
    width: 1200,
    height: 630,
  };
  
  return {
    title,
    description,
    openGraph: { url, images: image },
    twitter: { images: image },
  };
}

export default async function AddressPage({ params }: AddressPageProps) {
  const resolvedParams = await params;
  const { chain: chainSlug, address } = resolvedParams;
  
  // Get sourcifySupport from chain data
  const chain = l1ChainsData.find((c) => c.slug === chainSlug) as (L1Chain & { sourcifySupport?: boolean }) | undefined;
  
  return <AddressDetailPageClient network={resolvedParams.network} address={address} sourcifySupport={chain?.sourcifySupport} />;
}

