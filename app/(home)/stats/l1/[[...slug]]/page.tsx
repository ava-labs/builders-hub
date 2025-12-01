import { notFound, redirect } from "next/navigation";
import ChainMetricsPage from "@/components/stats/ChainMetricsPage";
import L1ExplorerPage from "@/components/explorer/L1ExplorerPage";
import BlockDetailPage from "@/components/explorer/BlockDetailPage";
import TransactionDetailPage from "@/components/explorer/TransactionDetailPage";
import AddressDetailPage from "@/components/explorer/AddressDetailPage";
import { ExplorerProvider } from "@/components/explorer/ExplorerContext";
import { ExplorerLayout } from "@/components/explorer/ExplorerLayout";
import CustomChainExplorer from "@/components/explorer/CustomChainExplorer";
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
  const isStats = slugArray[1] === "stats";
  const isExplorer = slugArray[1] === "explorer";
  const isBlock = slugArray[2] === "block";
  const isTx = slugArray[2] === "tx";
  const isAddress = slugArray[2] === "address";
  const blockNumber = isBlock ? slugArray[3] : undefined;
  const txHash = isTx ? slugArray[3] : undefined;
  const address = isAddress ? slugArray[3] : undefined;
  
  const currentChain = l1ChainsData.find((c) => c.slug === chainSlug) as L1Chain;

  // For custom chains (not in static data), return generic metadata
  // The actual chain name will be resolved client-side from localStorage
  // Server-side metadata can't access localStorage, so we use a generic title
  if (!currentChain) {
    return {
      title: `Custom Chain Explorer | Avalanche L1`,
      description: `Explore blockchain data on Avalanche.`,
    };
  }

  let title = `${currentChain.chainName} Metrics`;
  let description = `Track ${currentChain.chainName} L1 activity with real-time metrics including active addresses, transactions, gas usage, fees, and network performance data.`;
  let url = `/stats/l1/${chainSlug}/stats`;

  if (isExplorer && isAddress && address) {
    const shortAddress = `${address.slice(0, 10)}...${address.slice(-8)}`;
    title = `Address ${shortAddress} | ${currentChain.chainName} Explorer`;
    description = `View address details on ${currentChain.chainName} - balance, tokens, transactions, and more.`;
    url = `/stats/l1/${chainSlug}/explorer/address/${address}`;
  } else if (isExplorer && isTx && txHash) {
    const shortHash = `${txHash.slice(0, 10)}...${txHash.slice(-8)}`;
    title = `Transaction ${shortHash} | ${currentChain.chainName} Explorer`;
    description = `View transaction details on ${currentChain.chainName} - status, value, gas, and more.`;
    url = `/stats/l1/${chainSlug}/explorer/tx/${txHash}`;
  } else if (isExplorer && isBlock && blockNumber) {
    title = `Block #${blockNumber} | ${currentChain.chainName} Explorer`;
    description = `View details for block #${blockNumber} on ${currentChain.chainName} - transactions, gas usage, and more.`;
    url = `/stats/l1/${chainSlug}/explorer/block/${blockNumber}`;
  } else if (isExplorer) {
    title = `${currentChain.chainName} Explorer`;
    description = `Explore ${currentChain.chainName} blockchain - search transactions, blocks, and addresses.`;
    url = `/stats/l1/${chainSlug}/explorer`;
  }

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
  const isStats = slugArray[1] === "stats";
  const isExplorer = slugArray[1] === "explorer";
  const isBlock = slugArray[2] === "block";
  const isTx = slugArray[2] === "tx";
  const isAddress = slugArray[2] === "address";
  const blockNumber = isBlock ? slugArray[3] : undefined;
  const txHash = isTx ? slugArray[3] : undefined;
  const address = isAddress ? slugArray[3] : undefined;

  if (!chainSlug) { notFound(); }

  const currentChain = l1ChainsData.find((c) => c.slug === chainSlug) as L1Chain;

  // Redirect /stats/l1/{chainSlug} to /stats/l1/{chainSlug}/explorer for better UX
  if (slugArray.length === 1) {
    redirect(`/stats/l1/${chainSlug}/explorer`);
  }

  // For explorer pages, if chain not found in static data, try custom chains from localStorage
  if (!currentChain && isExplorer) {
    let pageType: "explorer" | "block" | "tx" | "address" = "explorer";
    if (isBlock) pageType = "block";
    else if (isTx) pageType = "tx";
    else if (isAddress) pageType = "address";

    return (
      <CustomChainExplorer
        slug={chainSlug}
        pageType={pageType}
        blockNumber={blockNumber}
        txHash={txHash}
        address={address}
      />
    );
  }

  // For stats pages or if chain not found at all, return 404
  if (!currentChain) { notFound(); }

  // All explorer pages wrapped with ExplorerProvider and ExplorerLayout
  if (isExplorer) {
    const explorerProps = {
      chainId: currentChain.chainId,
      chainName: currentChain.chainName,
      chainSlug: currentChain.slug,
      themeColor: currentChain.color || "#E57373",
      chainLogoURI: currentChain.chainLogoURI,
      nativeToken: currentChain.tokenSymbol,
      description: currentChain.description,
      website: currentChain.website,
      socials: currentChain.socials,
      rpcUrl: currentChain.rpcUrl,
    };

    // Address detail page: /stats/l1/{chainSlug}/explorer/address/{address}
    if (isAddress && address) {
      const shortAddress = `${address.slice(0, 10)}...${address.slice(-8)}`;
      return (
        <ExplorerProvider {...explorerProps}>
          <ExplorerLayout {...explorerProps} breadcrumbItems={[{ label: shortAddress }]}>
          <AddressDetailPage {...explorerProps} address={address} sourcifySupport={(currentChain as any).sourcifySupport} />
          </ExplorerLayout>
        </ExplorerProvider>
      );
    }

    // Transaction detail page: /stats/l1/{chainSlug}/explorer/tx/{txHash}
    if (isTx && txHash) {
      const shortHash = `${txHash.slice(0, 10)}...${txHash.slice(-8)}`;
      return (
        <ExplorerProvider {...explorerProps}>
          <ExplorerLayout {...explorerProps} breadcrumbItems={[{ label: shortHash }]}>
          <TransactionDetailPage {...explorerProps} txHash={txHash} />
          </ExplorerLayout>
        </ExplorerProvider>
      );
    }

    // Block detail page: /stats/l1/{chainSlug}/explorer/block/{blockNumber}
    if (isBlock && blockNumber) {
      return (
        <ExplorerProvider {...explorerProps}>
          <ExplorerLayout {...explorerProps} breadcrumbItems={[{ label: `Block #${blockNumber}` }]}>
          <BlockDetailPage {...explorerProps} blockNumber={blockNumber} />
          </ExplorerLayout>
        </ExplorerProvider>
      );
    }

    // Explorer home page: /stats/l1/{chainSlug}/explorer
    return (
      <ExplorerProvider {...explorerProps}>
        <ExplorerLayout {...explorerProps} showSearch>
        <L1ExplorerPage {...explorerProps} />
        </ExplorerLayout>
      </ExplorerProvider>
    );
  }

  // L1 Metrics page: /stats/l1/{chainSlug}/stats
  if (isStats) {
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
