import { notFound } from "next/navigation";
import ChainMetricsPage from "@/components/stats/ChainMetricsPage";
import l1ChainsData from "@/constants/l1-chains.json";
import { Metadata } from "next";

interface L1Chain {
  chainId: string;
  chainName: string;
  chainLogoURI: string;
  subnetId: string;
  slug: string;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug?: string[] }>;
}): Promise<Metadata> {
  const resolvedParams = await params;
  const slug = Array.isArray(resolvedParams.slug) ? resolvedParams.slug[0] : resolvedParams.slug;
  const currentChain = l1ChainsData.find((c) => c.slug === slug) as L1Chain;

  if (!currentChain) { return notFound(); }

  const title = `${currentChain.chainName} L1 Metrics`;
  const description = `Track ${currentChain.chainName} L1 activity with real-time metrics including active addresses, transactions, gas usage, fees, and network performance data.`;

  const imageParams = new URLSearchParams();
  imageParams.set("title", title);
  imageParams.set("description", description);

  const image = {
    alt: `${currentChain.chainName} L1 Metrics`,
    url: `/api/og/stats/${slug}?${imageParams.toString()}`,
    width: 1280,
    height: 720,
  };

  return {
    title,
    description,
    openGraph: {
      url: `/stats/l1/${slug}`,
      images: image,
    },
    twitter: {
      images: image,
    },
  };
}

export default async function L1Metrics({
  params,
}: {
  params: Promise<{ slug?: string[] }>;
}) {
  const resolvedParams = await params;
  const slug = Array.isArray(resolvedParams.slug) ? resolvedParams.slug[0] : resolvedParams.slug;

  if (!slug) { notFound(); }

  const currentChain = l1ChainsData.find((c) => c.slug === slug) as L1Chain;

  if (!currentChain) { notFound(); }

  return (
    <ChainMetricsPage
      chainId={currentChain.chainId}
      chainName={currentChain.chainName}
      description={`Real-time insights into ${currentChain.chainName} L1 activity and network usage`}
    />
  );
}
