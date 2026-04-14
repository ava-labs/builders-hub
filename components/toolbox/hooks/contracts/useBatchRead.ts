import { useMemo } from 'react';
import { type Abi, type PublicClient } from 'viem';

/**
 * Describes a single contract read to batch via multicall.
 */
export interface BatchReadContract {
  address: `0x${string}`;
  abi: Abi | readonly unknown[];
  functionName: string;
  args?: readonly unknown[];
}

/**
 * Result from a single batched read. When `allowFailure: true`,
 * each result is either `{ status: 'success', result }` or `{ status: 'failure', error }`.
 */
export type BatchReadResult = { status: 'success'; result: unknown } | { status: 'failure'; error: Error };

/**
 * Returns a `batchRead` function that executes multiple contract reads
 * in a single RPC call using viem's deployless multicall.
 *
 * Deployless multicall injects Multicall3 bytecode via `eth_call` state
 * override, so it works on any EVM chain without requiring Multicall3
 * to be deployed on-chain. Zero gas cost.
 *
 * The public client is configured with `batch.multicall.deployless: true`
 * in `useChainPublicClient`, so all multicall calls auto-use deployless mode.
 *
 * @param publicClient - The viem public client (from useChainPublicClient)
 */
export function useBatchRead(publicClient: PublicClient | null) {
  return useMemo(() => {
    return async function batchRead(contracts: readonly BatchReadContract[]): Promise<BatchReadResult[]> {
      if (!publicClient) {
        throw new Error('Public client not available');
      }

      const results = await publicClient.multicall({
        contracts: contracts.map((c) => ({
          address: c.address,
          abi: c.abi as Abi,
          functionName: c.functionName,
          args: c.args ?? [],
        })),
        allowFailure: true,
      });

      return results as BatchReadResult[];
    };
  }, [publicClient]);
}
