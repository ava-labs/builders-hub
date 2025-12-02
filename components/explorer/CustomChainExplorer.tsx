"use client";

import { useEffect, useState } from "react";
import { L1Chain } from "@/types/stats";
import { getL1ListStore, L1ListItem } from "@/components/toolbox/stores/l1ListStore";
import { convertL1ListItemToL1Chain, findCustomChainBySlug } from "./utils/chainConverter";
import { ExplorerProvider } from "./ExplorerContext";
import { ExplorerLayout } from "./ExplorerLayout";
import L1ExplorerPage from "./L1ExplorerPage";
import BlockDetailPage from "./BlockDetailPage";
import TransactionDetailPage from "./TransactionDetailPage";
import AddressDetailPage from "./AddressDetailPage";
import { Loader2 } from "lucide-react";

interface CustomChainExplorerProps {
  slug: string;
  pageType: "explorer" | "block" | "tx" | "address";
  blockNumber?: string;
  txHash?: string;
  address?: string;
}

export default function CustomChainExplorer({
  slug,
  pageType,
  blockNumber,
  txHash,
  address,
}: CustomChainExplorerProps) {
  const [chain, setChain] = useState<L1Chain | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    // Check both testnet and mainnet stores
    const testnetStore = getL1ListStore(true);
    const mainnetStore = getL1ListStore(false);
    
    const testnetChains: L1ListItem[] = testnetStore.getState().l1List;
    const mainnetChains: L1ListItem[] = mainnetStore.getState().l1List;
    
    // Combine all chains and search
    const allChains = [...testnetChains, ...mainnetChains];
    const customChain = findCustomChainBySlug(allChains, slug);
    
    if (customChain) {
      setChain(convertL1ListItemToL1Chain(customChain));
    } else {
      setNotFound(true);
    }
    setLoading(false);
  }, [slug]);

  // Update document title when chain or page type changes
  useEffect(() => {
    if (!chain) return;
    
    let title = `${chain.chainName} Explorer | Avalanche L1`;
    
    if (pageType === "address" && address) {
      const shortAddress = `${address.slice(0, 10)}...${address.slice(-8)}`;
      title = `Address ${shortAddress} | ${chain.chainName} Explorer`;
    } else if (pageType === "tx" && txHash) {
      const shortHash = `${txHash.slice(0, 10)}...${txHash.slice(-8)}`;
      title = `Transaction ${shortHash} | ${chain.chainName} Explorer`;
    } else if (pageType === "block" && blockNumber) {
      title = `Block #${blockNumber} | ${chain.chainName} Explorer`;
    }
    
    document.title = title;
  }, [chain, pageType, address, txHash, blockNumber]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-zinc-400" />
      </div>
    );
  }

  if (notFound || !chain) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <h1 className="text-2xl font-bold text-zinc-100">Chain Not Found</h1>
        <p className="text-zinc-400">
          The chain &quot;{slug}&quot; was not found in the registry or your custom chains.
        </p>
        <p className="text-zinc-500 text-sm">
          You can add custom chains in the{" "}
          <a href="/console" className="text-blue-400 hover:underline">
            Console
          </a>
          .
        </p>
      </div>
    );
  }

  const explorerProps = {
    chainId: chain.chainId,
    chainName: chain.chainName,
    chainSlug: chain.slug,
    themeColor: chain.color || "#E57373",
    chainLogoURI: chain.chainLogoURI,
    nativeToken: chain.tokenSymbol,
    description: chain.description,
    website: chain.website,
    socials: chain.socials,
    rpcUrl: chain.rpcUrl,
  };

  // Address detail page
  if (pageType === "address" && address) {
    const shortAddress = `${address.slice(0, 10)}...${address.slice(-8)}`;
    return (
      <ExplorerProvider {...explorerProps}>
        <ExplorerLayout {...explorerProps} breadcrumbItems={[{ label: shortAddress }]}>
          <AddressDetailPage {...explorerProps} address={address} />
        </ExplorerLayout>
      </ExplorerProvider>
    );
  }

  // Transaction detail page
  if (pageType === "tx" && txHash) {
    const shortHash = `${txHash.slice(0, 10)}...${txHash.slice(-8)}`;
    return (
      <ExplorerProvider {...explorerProps}>
        <ExplorerLayout {...explorerProps} breadcrumbItems={[{ label: shortHash }]}>
          <TransactionDetailPage {...explorerProps} txHash={txHash} />
        </ExplorerLayout>
      </ExplorerProvider>
    );
  }

  // Block detail page
  if (pageType === "block" && blockNumber) {
    return (
      <ExplorerProvider {...explorerProps}>
        <ExplorerLayout {...explorerProps} breadcrumbItems={[{ label: `Block #${blockNumber}` }]}>
          <BlockDetailPage {...explorerProps} blockNumber={blockNumber} />
        </ExplorerLayout>
      </ExplorerProvider>
    );
  }

  // Explorer home page
  return (
    <ExplorerProvider {...explorerProps}>
      <ExplorerLayout {...explorerProps} showSearch>
        <L1ExplorerPage {...explorerProps} />
      </ExplorerLayout>
    </ExplorerProvider>
  );
}

