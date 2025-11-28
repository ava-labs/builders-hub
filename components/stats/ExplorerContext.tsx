"use client";

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";

interface PriceData {
  price: number;
  priceInAvax?: number;
  change24h: number;
  marketCap: number;
  volume24h: number;
  totalSupply?: number;
  symbol?: string;
}

interface ChainInfo {
  chainId: string;
  chainName: string;
  chainSlug: string;
  themeColor: string;
  chainLogoURI?: string;
  nativeToken?: string;
  description?: string;
  website?: string;
  socials?: {
    twitter?: string;
    linkedin?: string;
  };
}

interface ExplorerContextValue {
  // Chain info
  chainInfo: ChainInfo | null;
  setChainInfo: (info: ChainInfo) => void;
  
  // Token data
  tokenSymbol: string;
  tokenPrice: number | null;
  priceData: PriceData | null;
  
  // Glacier support
  glacierSupported: boolean;
  
  // Loading state
  isTokenDataLoading: boolean;
  
  // Refresh function
  refreshTokenData: () => Promise<void>;
}

const ExplorerContext = createContext<ExplorerContextValue | null>(null);

// Cache for token data per chainId
const tokenDataCache = new Map<string, { data: PriceData | null; symbol: string; glacierSupported: boolean; timestamp: number }>();
const CACHE_DURATION = 60 * 1000; // 1 minute cache

interface ExplorerProviderProps {
  children: ReactNode;
  chainId: string;
  chainName: string;
  chainSlug: string;
  themeColor?: string;
  chainLogoURI?: string;
  nativeToken?: string;
  description?: string;
  website?: string;
  socials?: {
    twitter?: string;
    linkedin?: string;
  };
}

export function ExplorerProvider({
  children,
  chainId,
  chainName,
  chainSlug,
  themeColor = "#E57373",
  chainLogoURI,
  nativeToken,
  description,
  website,
  socials,
}: ExplorerProviderProps) {
  const [chainInfo, setChainInfo] = useState<ChainInfo>({
    chainId,
    chainName,
    chainSlug,
    themeColor,
    chainLogoURI,
    nativeToken,
    description,
    website,
    socials,
  });
  
  const [tokenSymbol, setTokenSymbol] = useState<string>(nativeToken || 'AVAX');
  const [tokenPrice, setTokenPrice] = useState<number | null>(null);
  const [priceData, setPriceData] = useState<PriceData | null>(null);
  const [glacierSupported, setGlacierSupported] = useState<boolean>(false);
  const [isTokenDataLoading, setIsTokenDataLoading] = useState(false);
  
  const fetchTokenData = useCallback(async (forceRefresh = false) => {
    // Check cache first
    const cached = tokenDataCache.get(chainId);
    const now = Date.now();
    
    if (!forceRefresh && cached && (now - cached.timestamp) < CACHE_DURATION) {
      setTokenSymbol(cached.symbol);
      setPriceData(cached.data);
      setTokenPrice(cached.data?.price || null);
      setGlacierSupported(cached.glacierSupported);
      return;
    }
    
    setIsTokenDataLoading(true);
    
    try {
      const response = await fetch(`/api/explorer/${chainId}`);
      if (response.ok) {
        const data = await response.json();
        const symbol = data?.tokenSymbol || data?.price?.symbol || nativeToken || 'AVAX';
        const price = data?.price || null;
        const isGlacierSupported = data?.glacierSupported ?? false;
        
        // Update state
        setTokenSymbol(symbol);
        setPriceData(price);
        setTokenPrice(price?.price || null);
        setGlacierSupported(isGlacierSupported);
        
        // Update cache
        tokenDataCache.set(chainId, {
          data: price,
          symbol,
          glacierSupported: isGlacierSupported,
          timestamp: now,
        });
      }
    } catch (err) {
      console.error("Error fetching token data:", err);
    } finally {
      setIsTokenDataLoading(false);
    }
  }, [chainId, nativeToken]);
  
  // Initial fetch
  useEffect(() => {
    fetchTokenData();
  }, [fetchTokenData]);
  
  // Update chain info when props change
  useEffect(() => {
    setChainInfo({
      chainId,
      chainName,
      chainSlug,
      themeColor,
      chainLogoURI,
      nativeToken,
      description,
      website,
      socials,
    });
  }, [chainId, chainName, chainSlug, themeColor, chainLogoURI, nativeToken, description, website, socials]);
  
  const refreshTokenData = useCallback(async () => {
    await fetchTokenData(true);
  }, [fetchTokenData]);
  
  const value: ExplorerContextValue = {
    chainInfo,
    setChainInfo,
    tokenSymbol,
    tokenPrice,
    priceData,
    glacierSupported,
    isTokenDataLoading,
    refreshTokenData,
  };
  
  return (
    <ExplorerContext.Provider value={value}>
      {children}
    </ExplorerContext.Provider>
  );
}

export function useExplorer() {
  const context = useContext(ExplorerContext);
  if (!context) {
    throw new Error("useExplorer must be used within an ExplorerProvider");
  }
  return context;
}

// Optional hook that doesn't throw if outside provider (for optional usage)
export function useExplorerOptional() {
  return useContext(ExplorerContext);
}

