'use client';

import { useCallback } from 'react';
import { useWalletStore } from '@/components/toolbox/stores/walletStore';
import { useViemChainStore } from '@/components/toolbox/stores/toolboxStore';
import { getTxHistoryStore } from '@/components/toolbox/stores/txHistoryStore';
import { useResolvedWalletClient } from '@/components/toolbox/hooks/useResolvedWalletClient';
import useConsoleNotifications from '@/hooks/useConsoleNotifications';
import type { Hex } from '@/lib/eerc/types';

/**
 * Shared per-call write helper for the eERC flows.
 *
 * Why this exists separately from `useContractActions`: that hook binds a
 * single (address, abi) pair at hook-init time, which fits the precompile
 * pages where one component talks to one contract. The eERC flow hits
 * multiple contracts per user action (registrar, EncryptedERC, the source
 * ERC20 for approve, etc.), so we need a per-call writer.
 *
 * What this gives every eERC tx for free:
 *   1. Console toast on submit (via `useConsoleNotifications`).
 *   2. Row in the tx-history store (via `getTxHistoryStore`).
 *   3. Network + chainId metadata so the history rows show on the right
 *      filter when the user is testing across chains.
 *
 * Without this, eERC txs broadcast silently — no toast, no history —
 * which made every encrypted-erc demo feel detached from the rest of
 * the console.
 */
export function useEERCNotifiedWrite() {
  const walletClient = useResolvedWalletClient();
  const { notify } = useConsoleNotifications();
  const { isTestnet } = useWalletStore();
  const viemChain = useViemChainStore();

  return useCallback(
    async (
      args: {
        address: Hex;
        abi: unknown[];
        functionName: string;
        args: unknown[];
      },
      notificationName: string,
    ): Promise<Hex> => {
      if (!walletClient) throw new Error('Wallet not connected');

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const writePromise = (walletClient as any).writeContract({
        address: args.address,
        abi: args.abi,
        functionName: args.functionName,
        args: args.args,
      });

      // Toast tracks status on its own via the writePromise. `viemChain`
      // can be null when the wallet store hasn't resolved a chain yet
      // (rare on the eERC pages, which gate behind wallet readiness, but
      // typed as nullable). `notify` accepts `Chain | undefined` only,
      // so coerce to `undefined`.
      notify({ type: 'call', name: notificationName }, writePromise, viemChain ?? undefined);

      const hash = (await writePromise) as Hex;

      // Mirror the row that `useContractActions().write()` writes for
      // every other contract action so the eERC flow shows up in the
      // same console-history filter.
      getTxHistoryStore(Boolean(isTestnet))
        .getState()
        .addTx({
          type: 'evm',
          network: isTestnet ? 'fuji' : 'mainnet',
          operation: notificationName,
          txHash: hash,
          status: 'pending',
          contractAddress: args.address,
          chainId: viemChain?.id,
        });

      return hash;
    },
    [walletClient, notify, isTestnet, viemChain],
  );
}
