import { useMemo, useCallback } from 'react';
import { Avalanche } from '@avalanche-sdk/chainkit';
import { useWalletStore } from './walletStore';
import { aggregateWithRetry } from '../utils/aggregationRetry';

// Types for signature aggregation
interface SignatureAggregationParams {
  message: string;
  justification?: string;
  signingSubnetId?: string;
  quorumPercentage?: number;
}

/** Per-attempt cap; the SDK itself has no timeout configured. Generous on
 *  purpose (healthy aggregations take seconds): when it fires, the attempt
 *  is not retried, because the raced request may still be in flight. */
const AGGREGATION_ATTEMPT_TIMEOUT_MS = 60_000;

interface SignatureAggregationResult {
  signedMessage: string;
}

/**
 * Custom hook for interacting with the Avalanche SDK
 * Replaces useAvaCloudSDK with the new avalanche-sdk-typescript implementation
 */
export const useAvalancheSDKChainkit = (customNetwork?: 'mainnet' | 'fuji') => {
  const { isTestnet } = useWalletStore();

  const networkName = useMemo(() => {
    if (customNetwork) return customNetwork;
    return isTestnet ? 'fuji' : 'mainnet';
  }, [customNetwork, isTestnet]);

  // Create SDK instance using avalanche-sdk-typescript
  const sdk = useMemo(() => {
    return new Avalanche({
      network: networkName,
    });
  }, [networkName]);

  // Signature aggregation method
  const aggregateSignature = useCallback(
    async ({
      message,
      justification,
      signingSubnetId,
      quorumPercentage = 67,
    }: SignatureAggregationParams): Promise<SignatureAggregationResult> => {
      try {
        // Use the SDK's built-in signature aggregation method
        const signatureAggregatorRequest: any = {
          message,
          quorumPercentage,
        };

        // Add justification if provided
        if (justification) {
          signatureAggregatorRequest.justification = justification;
        }

        // If omitted, the Glacier aggregator service resolves the signing
        // subnet from the sourceChainID in the warp message.
        if (signingSubnetId) {
          signatureAggregatorRequest.signingSubnetId = signingSubnetId;
        }

        // Below-quorum results right after a P-Chain tx usually mean some
        // validators' own P-Chain views lag; they self-heal, so retry a few
        // times before surfacing the failure (see aggregationRetry.ts).
        const result = await aggregateWithRetry(() => {
          let timer: ReturnType<typeof setTimeout> | undefined;
          const timeout = new Promise<never>((_, reject) => {
            timer = setTimeout(
              () =>
                reject(
                  new Error(`signature aggregation attempt timed out after ${AGGREGATION_ATTEMPT_TIMEOUT_MS / 1000}s`),
                ),
              AGGREGATION_ATTEMPT_TIMEOUT_MS,
            );
          });
          return Promise.race([
            sdk.data.signatureAggregator.aggregate({ signatureAggregatorRequest }),
            timeout,
          ]).finally(() => clearTimeout(timer));
        });
        return { signedMessage: result.signedMessage };
      } catch (error) {
        console.error('Signature aggregation error:', error);
        throw error;
      }
    },
    [sdk],
  );

  return {
    // Raw SDK access for advanced usage
    sdk,
    networkName,

    // Signature aggregation (most common pattern)
    aggregateSignature,
  };
};
