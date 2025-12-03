"use client";

import { ReactNode, useEffect, useState, createContext, useContext } from "react";
import { ExplorerProvider } from "@/components/explorer/ExplorerContext";
import { ExplorerLayout } from "@/components/explorer/ExplorerLayout";
import { L1Chain } from "@/types/stats";
import { getL1ListStore, L1ListItem } from "@/components/toolbox/stores/l1ListStore";
import { convertL1ListItemToL1Chain, findCustomChainBySlug } from "@/components/explorer/utils/chainConverter";
import { Loader2 } from "lucide-react";

// Context to pass chain props to child pages
interface ChainContextValue {
  chainId: string;
  chainName: string;
  chainSlug: string;
  themeColor: string;
  chainLogoURI?: string;
  nativeToken?: string;
  description?: string;
  website?: string;
  rpcUrl?: string;
  socials?: { twitter?: string; linkedin?: string };
  sourcifySupport?: boolean;
}

const ChainContext = createContext<ChainContextValue | null>(null);

export function useChainContext() {
  const context = useContext(ChainContext);
  if (!context) {
    throw new Error("useChainContext must be used within ChainExplorerLayoutClient");
  }
  return context;
}

// Props for static chains (known at server time)
interface StaticChainProps {
  chainId: string;
  chainName: string;
  chainSlug: string;
  themeColor: string;
  chainLogoURI?: string;
  nativeToken?: string;
  description?: string;
  website?: string;
  rpcUrl?: string;
  socials?: { twitter?: string; linkedin?: string };
  sourcifySupport?: boolean;
  isCustomChain?: false;
  children: ReactNode;
}

// Props for custom chains (need client-side lookup)
interface CustomChainProps {
  chainSlug: string;
  isCustomChain: true;
  children: ReactNode;
}

type ChainExplorerLayoutClientProps = StaticChainProps | CustomChainProps;

export function ChainExplorerLayoutClient(props: ChainExplorerLayoutClientProps) {
  // If it's a static chain, we have all the data
  if (!props.isCustomChain) {
    const {
      chainId,
      chainName,
      chainSlug,
      themeColor,
      chainLogoURI,
      nativeToken,
      description,
      website,
      rpcUrl,
      socials,
      sourcifySupport,
      children,
    } = props;
    
    const contextValue: ChainContextValue = {
      chainId,
      chainName,
      chainSlug,
      themeColor,
      chainLogoURI,
      nativeToken,
      description,
      website,
      rpcUrl,
      socials,
      sourcifySupport,
    };

    return (
      <ChainContext.Provider value={contextValue}>
        <ExplorerProvider
          chainId={chainId}
          chainName={chainName}
          chainSlug={chainSlug}
          themeColor={themeColor}
          chainLogoURI={chainLogoURI}
          nativeToken={nativeToken}
          description={description}
          website={website}
          rpcUrl={rpcUrl}
          socials={socials}
        >
          {children}
        </ExplorerProvider>
      </ChainContext.Provider>
    );
  }

  // Custom chain - need to look up from localStorage
  return <CustomChainLoader chainSlug={props.chainSlug}>{props.children}</CustomChainLoader>;
}

// Separate component for custom chain loading
function CustomChainLoader({ 
  chainSlug, 
  children 
}: { 
  chainSlug: string; 
  children: ReactNode;
}) {
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
    const customChain = findCustomChainBySlug(allChains, chainSlug);
    
    if (customChain) {
      setChain(convertL1ListItemToL1Chain(customChain));
    } else {
      setNotFound(true);
    }
    setLoading(false);
  }, [chainSlug]);

  // Update document title when chain changes
  useEffect(() => {
    if (chain) {
      document.title = `${chain.chainName} Explorer | Avalanche L1`;
    }
  }, [chain]);

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
          The chain &quot;{chainSlug}&quot; was not found in the registry or your custom chains.
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

  const contextValue: ChainContextValue = {
    chainId: chain.chainId,
    chainName: chain.chainName,
    chainSlug: chain.slug,
    themeColor: chain.color || "#E57373",
    chainLogoURI: chain.chainLogoURI,
    nativeToken: chain.tokenSymbol,
    description: chain.description,
    website: chain.website,
    rpcUrl: chain.rpcUrl,
    socials: chain.socials,
  };

  return (
    <ChainContext.Provider value={contextValue}>
      <ExplorerProvider
        chainId={chain.chainId}
        chainName={chain.chainName}
        chainSlug={chain.slug}
        themeColor={chain.color || "#E57373"}
        chainLogoURI={chain.chainLogoURI}
        nativeToken={chain.tokenSymbol}
        description={chain.description}
        website={chain.website}
        rpcUrl={chain.rpcUrl}
        socials={chain.socials}
      >
        {children}
      </ExplorerProvider>
    </ChainContext.Provider>
  );
}

