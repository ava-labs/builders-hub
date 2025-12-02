import { notFound } from "next/navigation";
import ChainMetricsPage from "@/components/stats/ChainMetricsPage";
import l1ChainsData from "@/constants/l1-chains.json";
import { Metadata } from "next";
import { L1Chain } from "@/types/stats";

// Helper function to find chain by slug
function findChainBySlug(slug?: string): L1Chain | null {
  if (!slug) return null;
  return l1ChainsData.find((c) => c.slug === slug) as L1Chain || null;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug?: string[] }>;
}): Promise<Metadata> {
  const resolvedParams = await params;
  const slug = Array.isArray(resolvedParams.slug) ? resolvedParams.slug[0] : resolvedParams.slug;
  const currentChain = findChainBySlug(slug);

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

  const currentChain = findChainBySlug(slug);

  if (!currentChain) { notFound(); }

  return <ChainMetricsPage chain={currentChain} />;
}
