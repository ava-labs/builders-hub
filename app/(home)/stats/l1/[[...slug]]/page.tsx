import { notFound, redirect } from "next/navigation";
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
  const slugArray = resolvedParams.slug || [];
  const chainSlug = slugArray[0];
  
  const currentChain = l1ChainsData.find((c) => c.slug === chainSlug) as L1Chain;

  if (!currentChain) {
    return {
      title: `Chain Not Found | Avalanche L1`,
      description: `Chain data not available.`,
    };
  }

  let title = `${currentChain.chainName} Metrics`;
  let description = `Track ${currentChain.chainName} L1 activity with real-time metrics including active addresses, transactions, gas usage, fees, and network performance data.`;
  let url = `/stats/l1/${chainSlug}`;

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
    openGraph: {
      url,
      images: image,
    },
    twitter: {
      images: image,
    },
  };
}

export default async function L1Page({
  params,
}: {
  params: Promise<{ slug?: string[] }>;
}) {
  const resolvedParams = await params;
  const slugArray = resolvedParams.slug || [];
  const chainSlug = slugArray[0];
  const secondSegment = slugArray[1];
  const isExplorer = secondSegment === "explorer";
  const isBlock = slugArray[2] === "block";
  const isTx = slugArray[2] === "tx";
  const isAddress = slugArray[2] === "address";
  const blockNumber = isBlock ? slugArray[3] : undefined;
  const txHash = isTx ? slugArray[3] : undefined;
  const address = isAddress ? slugArray[3] : undefined;

  if (!chainSlug) { notFound(); }

  // Redirect explorer routes to new /explorer/ prefix
  if (isExplorer) {
    if (isAddress && address) {
      redirect(`/explorer/${chainSlug}/address/${address}`);
    } else if (isTx && txHash) {
      redirect(`/explorer/${chainSlug}/tx/${txHash}`);
    } else if (isBlock && blockNumber) {
      redirect(`/explorer/${chainSlug}/block/${blockNumber}`);
    } else {
      redirect(`/explorer/${chainSlug}`);
    }
  }

  const currentChain = l1ChainsData.find((c) => c.slug === chainSlug) as L1Chain;

  if (!currentChain) { notFound(); }

  // L1 Metrics page: /stats/l1/{chainSlug} (also handle legacy /stats/l1/{chainSlug}/stats)
  if (slugArray.length === 1 || secondSegment === "stats") {
    return (
      <ChainMetricsPage
        chainId={currentChain.chainId}
        chainName={currentChain.chainName}
        chainSlug={currentChain.slug}
        description={
          currentChain.description ||
          `Real-time insights into ${currentChain.chainName} L1 activity and network usage`
        }
        themeColor={currentChain.color || "#E57373"}
        chainLogoURI={currentChain.chainLogoURI}
        website={currentChain.website}
        socials={currentChain.socials}
        rpcUrl={currentChain.rpcUrl}
      />
    );
  }

  // If we reach here, the route doesn't match any known pattern
  notFound();
}
