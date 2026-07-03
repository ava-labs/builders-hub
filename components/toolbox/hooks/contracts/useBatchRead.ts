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
 * Returns a `batchRead` function that executes multiple contract reads.
 *
 * Primary path: viem's deployless multicall (one `eth_call`, zero gas) —
 * Multicall3 bytecode is injected so no on-chain deployment is required.
 * `deployless: true` is passed explicitly because the client no longer
 * enables `batch.multicall` (see useChainPublicClient for why).
 *
 * Fallback path: L1s that enable the Subnet-EVM Contract Deployer Allowlist
 * precompile reject the deployless multicall's contract-creation `eth_call`
 * ("tx.origin … is not authorized to deploy a contract"). When that happens
 * we transparently fall back to sequential plain `eth_call` reads, which the
 * precompile permits.
 *
 * @param publicClient - The viem public client (from useChainPublicClient)
 */
export function useBatchRead(publicClient: PublicClient | null) {
  return useMemo(() => {
    return async function batchRead(contracts: readonly BatchReadContract[]): Promise<BatchReadResult[]> {
      if (!publicClient) {
        throw new Error('Public client not available');
      }

      const mapped = contracts.map((c) => ({
        address: c.address,
        abi: c.abi as Abi,
        functionName: c.functionName,
        args: c.args ?? [],
      }));

      try {
        const results = await publicClient.multicall({
          contracts: mapped,
          allowFailure: true,
          deployless: true,
        });
        return results as BatchReadResult[];
      } catch {
        // Deployless multicall is blocked by the Contract Deployer Allowlist
        // precompile on permissioned L1s — fall back to sequential reads.
        return Promise.all(
          mapped.map(async (c): Promise<BatchReadResult> => {
            try {
              const result = await publicClient.readContract(c);
              return { status: 'success', result };
            } catch (error) {
              return { status: 'failure', error: error as Error };
            }
          }),
        );
      }
    };
  }, [publicClient]);
}
