import { notFound } from "next/navigation";
import L1ExplorerPage from "@/components/explorer/L1ExplorerPage";
import BlockDetailPage from "@/components/explorer/BlockDetailPage";
import TransactionDetailPage from "@/components/explorer/TransactionDetailPage";
import AddressDetailPage from "@/components/explorer/AddressDetailPage";
import { ExplorerProvider } from "@/components/explorer/ExplorerContext";
import { ExplorerLayout } from "@/components/explorer/ExplorerLayout";
import CustomChainExplorer from "@/components/explorer/CustomChainExplorer";
import AllChainsExplorerPage from "@/components/explorer/AllChainsExplorerPage";
import { AllChainsExplorerLayout } from "@/components/explorer/AllChainsExplorerLayout";
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
  const isBlock = slugArray[1] === "block";
  const isTx = slugArray[1] === "tx";
  const isAddress = slugArray[1] === "address";
  const blockNumber = isBlock ? slugArray[2] : undefined;
  const txHash = isTx ? slugArray[2] : undefined;
  const address = isAddress ? slugArray[2] : undefined;
  
  // If no chain slug, this is the All Chains Explorer page
  if (!chainSlug) {
    return {
      title: "All Chains Explorer | Avalanche Ecosystem",
      description: "Explore all Avalanche L1 chains in real-time - blocks, transactions, and cross-chain messages across the entire ecosystem.",
      openGraph: {
        title: "All Chains Explorer | Avalanche Ecosystem",
        description: "Explore all Avalanche L1 chains in real-time - blocks, transactions, and cross-chain messages across the entire ecosystem.",
      },
    };
  }
  
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

  let title = `${currentChain.chainName} Explorer`;
  let description = `Explore ${currentChain.chainName} blockchain - search transactions, blocks, and addresses.`;
  let url = `/explorer/${chainSlug}`;

  if (isAddress && address) {
    const shortAddress = `${address.slice(0, 10)}...${address.slice(-8)}`;
    title = `Address ${shortAddress} | ${currentChain.chainName} Explorer`;
    description = `View address details on ${currentChain.chainName} - balance, tokens, transactions, and more.`;
    url = `/explorer/${chainSlug}/address/${address}`;
  } else if (isTx && txHash) {
    const shortHash = `${txHash.slice(0, 10)}...${txHash.slice(-8)}`;
    title = `Transaction ${shortHash} | ${currentChain.chainName} Explorer`;
    description = `View transaction details on ${currentChain.chainName} - status, value, gas, and more.`;
    url = `/explorer/${chainSlug}/tx/${txHash}`;
  } else if (isBlock && blockNumber) {
    title = `Block #${blockNumber} | ${currentChain.chainName} Explorer`;
    description = `View details for block #${blockNumber} on ${currentChain.chainName} - transactions, gas usage, and more.`;
    url = `/explorer/${chainSlug}/block/${blockNumber}`;
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

export default async function ExplorerPage({
  params,
}: {
  params: Promise<{ slug?: string[] }>;
}) {
  const resolvedParams = await params;
  const slugArray = resolvedParams.slug || [];
  const chainSlug = slugArray[0];
  const isBlock = slugArray[1] === "block";
  const isTx = slugArray[1] === "tx";
  const isAddress = slugArray[1] === "address";
  const blockNumber = isBlock ? slugArray[2] : undefined;
  const txHash = isTx ? slugArray[2] : undefined;
  const address = isAddress ? slugArray[2] : undefined;

  // If no chain slug, show the All Chains Explorer
  if (!chainSlug) {
    return (
      <AllChainsExplorerLayout>
        <AllChainsExplorerPage />
      </AllChainsExplorerLayout>
    );
  }

  const currentChain = l1ChainsData.find((c) => c.slug === chainSlug) as L1Chain;

  // For explorer pages, if chain not found in static data, try custom chains from localStorage
  if (!currentChain) {
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

  // All explorer pages wrapped with ExplorerProvider and ExplorerLayout
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

  // Address detail page: /explorer/{chainSlug}/address/{address}
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

  // Transaction detail page: /explorer/{chainSlug}/tx/{txHash}
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

  // Block detail page: /explorer/{chainSlug}/block/{blockNumber}
  if (isBlock && blockNumber) {
    return (
      <ExplorerProvider {...explorerProps}>
        <ExplorerLayout {...explorerProps} breadcrumbItems={[{ label: `Block #${blockNumber}` }]}>
        <BlockDetailPage {...explorerProps} blockNumber={blockNumber} />
        </ExplorerLayout>
      </ExplorerProvider>
    );
  }

  // Explorer home page: /explorer/{chainSlug}
  return (
    <ExplorerProvider {...explorerProps}>
      <ExplorerLayout {...explorerProps} showSearch>
      <L1ExplorerPage {...explorerProps} />
      </ExplorerLayout>
    </ExplorerProvider>
  );
}

