"use client";

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, ReactNode } from "react";
import l1ChainsData from "@/constants/l1-chains.json";

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
  rpcUrl?: string;
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
  
  // Helper to build API URL with rpcUrl for custom chains
  buildApiUrl: (endpoint: string, additionalParams?: Record<string, string>) => string;
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
  rpcUrl?: string;
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
  rpcUrl,
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
    rpcUrl,
    socials,
  });
  
  const [tokenSymbol, setTokenSymbol] = useState<string>('');
  const [tokenPrice, setTokenPrice] = useState<number | null>(null);
  const [priceData, setPriceData] = useState<PriceData | null>(null);
  const [glacierSupported, setGlacierSupported] = useState<boolean>(false);
  // Start with true to prevent showing banner before data is fetched
  const [isTokenDataLoading, setIsTokenDataLoading] = useState(true);
  
  // Check if this chain exists in static l1-chains.json (custom chains won't be there)
  const isCustomChain = useMemo(() => {
    return !l1ChainsData.some((c: { chainId: string }) => c.chainId === chainId);
  }, [chainId]);
  
  // Helper to build API URLs with rpcUrl for custom chains only
  const buildApiUrl = useCallback((endpoint: string, additionalParams?: Record<string, string>): string => {
    const params = new URLSearchParams();
    
    // Only add rpcUrl and tokenSymbol for custom chains (not in l1-chains.json)
    if (isCustomChain) {
      if (rpcUrl) {
        params.set('rpcUrl', rpcUrl);
      }
      if (nativeToken) {
        params.set('tokenSymbol', nativeToken);
      }
    }
    
    // Add any additional params
    if (additionalParams) {
      for (const [key, value] of Object.entries(additionalParams)) {
        params.set(key, value);
      }
    }
    
    const queryString = params.toString();
    return queryString ? `${endpoint}?${queryString}` : endpoint;
  }, [isCustomChain, rpcUrl, nativeToken]);
  
  const fetchTokenData = useCallback(async (forceRefresh = false) => {
    // Check cache first
    const cacheKey = `${chainId}-${rpcUrl || ''}`;
    const cached = tokenDataCache.get(cacheKey);
    const now = Date.now();
    
    if (!forceRefresh && cached && (now - cached.timestamp) < CACHE_DURATION) {
      setTokenSymbol(cached.symbol);
      setPriceData(cached.data);
      setTokenPrice(cached.data?.price || null);
      setGlacierSupported(cached.glacierSupported);
      setIsTokenDataLoading(false);
      return;
    }
    
    setIsTokenDataLoading(true);
    
    try {
      // Only fetch price and glacier support (not full explorer data)
      const url = buildApiUrl(`/api/explorer/${chainId}`, { priceOnly: 'true' });
      const response = await fetch(url);
      if (response.ok) {
        const data = await response.json();
        const symbol = data?.tokenSymbol || data?.price?.symbol || nativeToken || '';
        const price = data?.price || null;
        const isGlacierSupported = data?.glacierSupported ?? false;
        
        // Update state
        setTokenSymbol(symbol);
        setPriceData(price);
        setTokenPrice(price?.price || null);
        setGlacierSupported(isGlacierSupported);
        
        // Update cache
        tokenDataCache.set(cacheKey, {
          data: price,
          symbol,
          glacierSupported: isGlacierSupported,
          timestamp: now,
        });
      }
    } catch (err) {
      console.error("Error fetching token data:", err);
      // For custom chains without price data, still set the native token symbol
      if (nativeToken) {
        setTokenSymbol(nativeToken);
      }
    } finally {
      setIsTokenDataLoading(false);
    }
  }, [chainId, nativeToken, rpcUrl, buildApiUrl]);
  
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
      rpcUrl,
      socials,
    });
  }, [chainId, chainName, chainSlug, themeColor, chainLogoURI, nativeToken, description, website, rpcUrl, socials]);
  
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
    buildApiUrl,
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

