import { Metadata } from "next";
import l1ChainsData from "@/constants/l1-chains.json";
import { L1Chain } from "@/types/stats";
import { TransactionDetailPageClient } from "./page.client";

interface TxPageProps {
  params: Promise<{ network: string; chain: string; txHash: string }>;
}

export async function generateMetadata({ params }: TxPageProps): Promise<Metadata> {
  const resolvedParams = await params;
  const { chain: chainSlug, txHash } = resolvedParams;
  
  const chain = l1ChainsData.find((c) => c.slug === chainSlug) as L1Chain | undefined;
  const shortHash = `${txHash.slice(0, 10)}...${txHash.slice(-8)}`;
  
  if (!chain) {
    return {
      title: `Transaction ${shortHash} | Custom Chain Explorer`,
      description: "View transaction details on Avalanche.",
    };
  }
  
  const title = `Transaction ${shortHash} | ${chain.chainName} Explorer`;
  const description = `View transaction details on ${chain.chainName} - status, value, gas, and more.`;
  const url = `/explorer/${resolvedParams.network}/${chainSlug}/tx/${txHash}`;
  
  // Live data card: the og route fetches the tx from the chain's RPC at
  // scrape time (value, status, fee, block, time) with a branded fallback.
  const image = {
    alt: title,
    url: `/api/og/tx/${resolvedParams.network}/${chainSlug}/${txHash}`,
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

export default async function TxPage({ params }: TxPageProps) {
  const { network, txHash } = await params;

  return <TransactionDetailPageClient network={network} txHash={txHash} />;
}

