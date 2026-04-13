import { useCallback } from 'react';
import { apiFetch } from '@/lib/api/client';

interface SafeAPIParams {
  chainId?: string;
  safeAddress?: string;
  ownerAddress?: string;
  safeAddresses?: string[];
  proposalData?: any;
  safeTxHash?: string;
  [key: string]: any;
}

/**
 * Custom hook for calling the Safe API backend
 *
 * @example
 * ```tsx
 * const { callSafeAPI } = useSafeAPI();
 *
 * // Get Safe info
 * const safeInfo = await callSafeAPI('getSafeInfo', {
 *   chainId: '43114',
 *   safeAddress: '0x123...'
 * });
 *
 * // Get Safes by owner
 * const safes = await callSafeAPI('getSafesByOwner', {
 *   chainId: '43114',
 *   ownerAddress: '0x456...'
 * });
 * ```
 */
export const useSafeAPI = () => {
  const callSafeAPI = useCallback(async <T = any>(action: string, params: SafeAPIParams = {}): Promise<T> => {
    return apiFetch<T>('/api/safe', {
      method: 'POST',
      body: { action, ...params },
    });
  }, []);

  return { callSafeAPI };
};

// Type definitions for common Safe API responses
export interface SafeInfo {
  address: string;
  nonce: number;
  threshold: number;
  owners: string[];
  masterCopy: string;
  modules: string[];
  fallbackHandler: string;
  guard: string;
  version: string;
}

export interface SafesByOwnerResponse {
  safes: string[];
}

export interface NonceResponse {
  nonce: number;
}

export interface AllSafesInfoResponse {
  safeInfos: Record<string, SafeInfo>;
  errors?: Record<string, string>;
}

export interface AshWalletUrlResponse {
  url: string;
  shortName: string;
}
