import { Metadata } from "next";
import l1ChainsData from "@/constants/l1-chains.json";
import { L1Chain } from "@/types/stats";
import { TransactionDetailPageClient } from "./page.client";

interface TxPageProps {
  params: Promise<{ chainSlug: string; txHash: string }>;
}

export async function generateMetadata({ params }: TxPageProps): Promise<Metadata> {
  const resolvedParams = await params;
  const { chainSlug, txHash } = resolvedParams;
  
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
  const url = `/explorer/${chainSlug}/tx/${txHash}`;
  
  const imageParams = new URLSearchParams();
  imageParams.set("title", title);
  imageParams.set("description", description);
  
  const image = {
    alt: title,
    url: `/api/og/stats/${chainSlug}?${imageParams.toString()}`,
    width: 1280,
    height: 720,
  };
  
  return {
    title,
    description,
    openGraph: { url, images: image },
    twitter: { images: image },
  };
}

export default async function TxPage({ params }: TxPageProps) {
  const resolvedParams = await params;
  const { txHash } = resolvedParams;
  
  return <TransactionDetailPageClient txHash={txHash} />;
}

