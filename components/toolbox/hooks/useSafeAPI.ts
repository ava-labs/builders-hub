import { useCallback } from 'react';

interface SafeAPIParams {
  chainId?: string;
  safeAddress?: string;
  ownerAddress?: string;
  safeAddresses?: string[];
  proposalData?: any;
  safeTxHash?: string;
  [key: string]: any;
}

interface SafeAPIResponse<T = any> {
  success: boolean;
  data: T;
  error?: string;
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
    const response = await fetch('/api/safe', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ action, ...params }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `HTTP ${response.status}: Failed to ${action}`);
    }

    const result: SafeAPIResponse<T> = await response.json();
    if (!result.success) {
      throw new Error(result.error || `Failed to ${action}`);
    }

    return result.data;
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
