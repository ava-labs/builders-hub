import { Metadata } from "next";
import { redirect } from "next/navigation";
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
  const { network, chain, txHash } = await params;
  // C-Chain atomic (import/export) tx IDs are CB58, not 0x hashes
  // todo: find a way to show results on the tx page itself
  if (chain === "c-chain" && /^[1-9A-HJ-NP-Za-km-z]{40,}$/.test(txHash)) {
    redirect(`/explorer/${network}/c-chain/atomic-tx/${txHash}`);
  }

  return <TransactionDetailPageClient network={network} txHash={txHash} />;
}

