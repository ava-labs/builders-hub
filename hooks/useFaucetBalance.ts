"use client";

import { useState, useEffect, useCallback } from 'react';

interface ChainBalance {
  chainId: number;
  chainName: string;
  balance: string;
  balanceFormatted: string;
  symbol: string;
  faucetAddress: string;
}

export interface ERC20TokenBalance {
  chainId: number;
  tokenAddress: string;
  symbol: string;
  decimals: number;
  kind: 'wrapped-native' | 'erc20';
  balance: string;
  balanceFormatted: string;
}

interface FaucetBalances {
  pChain?: {
    balance: string;
    balanceFormatted: string;
    faucetAddress: string;
  };
  evmChains: ChainBalance[];
  erc20Tokens: ERC20TokenBalance[];
}

interface UseFaucetBalanceReturn {
  balances: FaucetBalances | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  getBalanceForChain: (chainId: number) => ChainBalance | undefined;
  getBalanceForToken: (chainId: number, tokenAddress: string) => ERC20TokenBalance | undefined;
}

// Cache the balances for 30 seconds to avoid excessive API calls
let cachedBalances: FaucetBalances | null = null;
let cacheTimestamp: number = 0;
const CACHE_DURATION = 30000; // 30 seconds

export function useFaucetBalance(): UseFaucetBalanceReturn {
  const [balances, setBalances] = useState<FaucetBalances | null>(cachedBalances);
  const [isLoading, setIsLoading] = useState(!cachedBalances);
  const [error, setError] = useState<string | null>(null);

  const fetchBalances = useCallback(async () => {
    // Check if cache is still valid
    const now = Date.now();
    if (cachedBalances && now - cacheTimestamp < CACHE_DURATION) {
      setBalances(cachedBalances);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/faucet-balance');
      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || 'Failed to fetch faucet balances');
      }

      const newBalances: FaucetBalances = {
        pChain: data.pChain,
        evmChains: data.evmChains || [],
        erc20Tokens: data.erc20Tokens || [],
      };

      // Update cache
      cachedBalances = newBalances;
      cacheTimestamp = now;

      setBalances(newBalances);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch balances');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const refetch = useCallback(async () => {
    // Force refetch by invalidating cache
    cacheTimestamp = 0;
    await fetchBalances();
  }, [fetchBalances]);

  const getBalanceForChain = useCallback((chainId: number): ChainBalance | undefined => {
    return balances?.evmChains.find(chain => chain.chainId === chainId);
  }, [balances]);

  const getBalanceForToken = useCallback((chainId: number, tokenAddress: string): ERC20TokenBalance | undefined => {
    const wanted = tokenAddress.toLowerCase();
    return balances?.erc20Tokens.find(
      token => token.chainId === chainId && token.tokenAddress.toLowerCase() === wanted
    );
  }, [balances]);

  useEffect(() => {
    fetchBalances();
  }, [fetchBalances]);

  return {
    balances,
    isLoading,
    error,
    refetch,
    getBalanceForChain,
    getBalanceForToken,
  };
}
