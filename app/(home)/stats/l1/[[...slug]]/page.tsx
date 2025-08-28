"use client";
import { useParams, notFound } from "next/navigation";
import ChainMetricsPage from "@/components/stats/ChainMetricsPage";
import l1ChainsData from "@/constants/l1-chains.json";

interface L1Chain {
  chainId: string;
  chainName: string;
  chainLogoURI: string;
  subnetId: string;
  slug: string;
}

export default function L1Metrics() {
  const params = useParams();
  const slug = Array.isArray(params.slug) ? params.slug[0] : params.slug;

  if (!slug) {
    notFound();
  }

  const currentChain = l1ChainsData.find((c) => c.slug === slug) as
    | L1Chain
    | undefined;

  if (!currentChain) {
    notFound();
  }

  return (
    <ChainMetricsPage
      chainId={currentChain.chainId}
      chainName={currentChain.chainName}
      description={`Real-time insights into ${currentChain.chainName} activity and network usage`}
    />
  );
}
