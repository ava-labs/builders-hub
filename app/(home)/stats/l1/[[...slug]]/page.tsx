import { notFound } from "next/navigation";
import ChainMetricsPage from "@/components/stats/ChainMetricsPage";
import L1ExplorerPage from "@/components/stats/L1ExplorerPage";
import BlockDetailPage from "@/components/stats/BlockDetailPage";
import TransactionDetailPage from "@/components/stats/TransactionDetailPage";
import AddressDetailPage from "@/components/stats/AddressDetailPage";
import { ExplorerProvider } from "@/components/stats/ExplorerContext";
import { ExplorerLayout } from "@/components/stats/ExplorerLayout";
import l1ChainsData from "@/constants/l1-chains.json";
import { Metadata } from "next";
import { L1Chain } from "@/types/stats";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug?: string[] }>;
}): Promise<Metadata> {
  const resolvedParams = await params;
  const slugArray = resolvedParams.slug || [];
  const chainSlug = slugArray[0];
  const isExplorer = slugArray[1] === "explorer";
  const isBlock = slugArray[2] === "block";
  const isTx = slugArray[2] === "tx";
  const isAddress = slugArray[2] === "address";
  const blockNumber = isBlock ? slugArray[3] : undefined;
  const txHash = isTx ? slugArray[3] : undefined;
  const address = isAddress ? slugArray[3] : undefined;
  
  const currentChain = l1ChainsData.find((c) => c.slug === chainSlug) as L1Chain;

  if (!currentChain) { return notFound(); }

  let title = `${currentChain.chainName} L1 Metrics`;
  let description = `Track ${currentChain.chainName} L1 activity with real-time metrics including active addresses, transactions, gas usage, fees, and network performance data.`;
  let url = `/stats/l1/${chainSlug}`;

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
  const isExplorer = slugArray[1] === "explorer";
  const isBlock = slugArray[2] === "block";
  const isTx = slugArray[2] === "tx";
  const isAddress = slugArray[2] === "address";
  const blockNumber = isBlock ? slugArray[3] : undefined;
  const txHash = isTx ? slugArray[3] : undefined;
  const address = isAddress ? slugArray[3] : undefined;

  if (!chainSlug) { notFound(); }

  const currentChain = l1ChainsData.find((c) => c.slug === chainSlug) as L1Chain;

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
          <AddressDetailPage {...explorerProps} address={address} />
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

  // L1 Metrics page: /stats/l1/{chainSlug}
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
