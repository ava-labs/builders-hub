"use client";

import { useState, useCallback, useEffect, useRef } from 'react';
import { useSession } from 'next-auth/react';
import { useWalletStore } from '@/components/toolbox/stores/walletStore';

interface RateLimitStatus {
  allowed: boolean;
  reason?: 'user_limit_exceeded' | 'destination_limit_exceeded';
  resetTime?: Date;
  userClaimsInWindow: number;
  destinationClaimsInWindow: number;
  maxClaimsPerUser: number;
  maxClaimsPerDestination: number;
  isLoading: boolean;
  error?: string;
}

interface UseFaucetRateLimitOptions {
  faucetType: 'pchain' | 'evm';
  chainId?: string | number;
  autoRefresh?: boolean;
  refreshInterval?: number; // in milliseconds
}

interface CachedRateLimitData {
  data: RateLimitStatus;
  timestamp: number;
}

const DEFAULT_STATUS: RateLimitStatus = {
  allowed: true,
  userClaimsInWindow: 0,
  destinationClaimsInWindow: 0,
  maxClaimsPerUser: 1,
  maxClaimsPerDestination: 2,
  isLoading: false
};

// Simple client-side cache to prevent redundant API calls
const rateLimitCache = new Map<string, CachedRateLimitData>();
const CACHE_TTL_MS = 60 * 1000; // 60 seconds cache
const COUNTDOWN_UPDATE_INTERVAL = 60 * 1000; // Update countdown every 60 seconds

function getCacheKey(faucetType: string, destinationAddress: string, chainId?: string | number): string {
  return `${faucetType}:${destinationAddress}:${chainId || 'null'}`;
}

export const useFaucetRateLimit = (options: UseFaucetRateLimitOptions) => {
  const { faucetType, chainId, autoRefresh = false, refreshInterval = 60000 } = options;
  const { data: session } = useSession();
  const { walletEVMAddress, pChainAddress, isTestnet } = useWalletStore();
  
  const [status, setStatus] = useState<RateLimitStatus>(DEFAULT_STATUS);
  const [timeUntilReset, setTimeUntilReset] = useState<string | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const countdownRef = useRef<NodeJS.Timeout | null>(null);
  const isFetchingRef = useRef(false);

  const destinationAddress = faucetType === 'pchain' ? pChainAddress : walletEVMAddress;

  const checkRateLimit = useCallback(async (forceRefresh = false) => {
    if (!session?.user || !destinationAddress || !isTestnet) {
      setStatus(DEFAULT_STATUS);
      return;
    }

    // Prevent concurrent requests
    if (isFetchingRef.current) return;

    const cacheKey = getCacheKey(faucetType, destinationAddress, chainId);
    
    // Check cache first (unless force refresh)
    if (!forceRefresh) {
      const cached = rateLimitCache.get(cacheKey);
      if (cached && (Date.now() - cached.timestamp) < CACHE_TTL_MS) {
        setStatus(cached.data);
        return;
      }
    }

    isFetchingRef.current = true;
    setStatus(prev => ({ ...prev, isLoading: true, error: undefined }));

    try {
      const params = new URLSearchParams({
        faucetType,
        address: destinationAddress
      });
      
      if (chainId !== undefined) {
        params.set('chainId', chainId.toString());
      }

      const response = await fetch(`/api/faucet-rate-limit?${params}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to check rate limit');
      }

      const newStatus: RateLimitStatus = {
        allowed: data.allowed,
        reason: data.reason,
        resetTime: data.resetTime ? new Date(data.resetTime) : undefined,
        userClaimsInWindow: data.userClaimsInWindow,
        destinationClaimsInWindow: data.destinationClaimsInWindow,
        maxClaimsPerUser: data.maxClaimsPerUser,
        maxClaimsPerDestination: data.maxClaimsPerDestination,
        isLoading: false
      };

      // Update cache
      rateLimitCache.set(cacheKey, {
        data: newStatus,
        timestamp: Date.now()
      });

      setStatus(newStatus);
    } catch (error) {
      setStatus(prev => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }));
    } finally {
      isFetchingRef.current = false;
    }
  }, [session?.user, destinationAddress, isTestnet, faucetType, chainId]);

  // Format time until reset
  const formatTimeUntilReset = useCallback((resetTime: Date): string => {
    const now = Date.now();
    const diffMs = resetTime.getTime() - now;
    
    if (diffMs <= 0) return 'now';
    
    const hours = Math.floor(diffMs / (1000 * 60 * 60));
    const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diffMs % (1000 * 60)) / 1000);
    
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    } else if (minutes > 0) {
      return `${minutes}m`;
    } else {
      return `${seconds}s`;
    }
  }, []);

  // Update countdown timer (less frequently - every 10 seconds)
  useEffect(() => {
    if (status.resetTime && !status.allowed) {
      const updateCountdown = () => {
        const formatted = formatTimeUntilReset(status.resetTime!);
        setTimeUntilReset(formatted);
        
        // If reset time has passed, refresh the rate limit status
        if (status.resetTime!.getTime() <= Date.now()) {
          checkRateLimit(true); // Force refresh when timer expires
        }
      };
      
      updateCountdown();
      countdownRef.current = setInterval(updateCountdown, COUNTDOWN_UPDATE_INTERVAL);
      
      return () => {
        if (countdownRef.current) {
          clearInterval(countdownRef.current);
        }
      };
    } else {
      setTimeUntilReset(null);
    }
  }, [status.resetTime, status.allowed, formatTimeUntilReset, checkRateLimit]);

  // Auto refresh
  useEffect(() => {
    if (autoRefresh && session?.user && destinationAddress && isTestnet) {
      checkRateLimit();
      intervalRef.current = setInterval(() => checkRateLimit(true), refreshInterval);
      
      return () => {
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
        }
      };
    }
  }, [autoRefresh, refreshInterval, session?.user, destinationAddress, isTestnet, checkRateLimit]);

  // Check on mount or when dependencies change
  useEffect(() => {
    if (session?.user && destinationAddress && isTestnet) {
      checkRateLimit();
    }
  }, [session?.user, destinationAddress, isTestnet, faucetType, chainId]);

  const getRateLimitMessage = useCallback((): string => {
    if (status.isLoading) return 'Checking...';
    if (status.error) return status.error;
    if (status.allowed) return 'Ready to claim';
    
    if (status.reason === 'user_limit_exceeded') {
      return timeUntilReset 
        ? `You can claim again in ${timeUntilReset}`
        : 'Daily limit reached';
    }
    
    if (status.reason === 'destination_limit_exceeded') {
      return timeUntilReset
        ? `This address can receive tokens again in ${timeUntilReset}`
        : 'Address daily limit reached';
    }
    
    return 'Rate limited';
  }, [status, timeUntilReset]);

  return {
    ...status,
    timeUntilReset,
    checkRateLimit: () => checkRateLimit(true), // Expose force refresh version
    getRateLimitMessage,
    canClaim: status.allowed && !status.isLoading && !status.error && isTestnet && !!destinationAddress
  };
};
