'use client';

import { useState } from 'react';
import ERC20TokenHomeABI from '@/contracts/icm-contracts/compiled/ERC20TokenHome.json';
import NativeTokenHomeABI from '@/contracts/icm-contracts/compiled/NativeTokenHome.json';
import ExampleERC20 from '@/contracts/icm-contracts/compiled/ExampleERC20.json';
import { useViemChainStore } from '@/components/toolbox/stores/toolboxStore';
import { useResolvedWalletClient } from '@/components/toolbox/hooks/useResolvedWalletClient';
import { makePublicClientForChain } from '@/components/toolbox/hooks/usePublicClientForChain';
import useConsoleNotifications from '@/hooks/useConsoleNotifications';
import { cb58ToHex } from '@/components/tools/common/utils/cb58';
import type { TokenKind } from '@/app/console/ictt/_components/types';

export interface ApproveCollateralArgs {
  tokenAddress: string;
  homeAddress: string;
  amount: bigint;
}

export interface AddCollateralArgs {
  homeAddress: string;
  homeKind: TokenKind;
  remoteChainId: string;
  remoteAddress: string;
  amount: bigint;
}

/**
 * Hook for the two-step collateral funding flow:
 *   1. (ERC-20 only) `approve(home, amount)` on the underlying token
 *   2. `addCollateral(remoteChainID, remoteAddr [, amount])` on TokenHome
 *
 * The hook itself doesn't own the approve/deposit ordering — that's
 * the inspector's job since it depends on the live allowance read.
 * Each function is independently callable. Status is exposed as a
 * three-way machine: 'idle' | 'approving' | 'depositing'.
 */
export function useAddCollateral() {
  const walletClient = useResolvedWalletClient();
  const viemChain = useViemChainStore();
  const { notify } = useConsoleNotifications();
  const [status, setStatus] = useState<'idle' | 'approving' | 'depositing'>('idle');
  const [error, setError] = useState<string | null>(null);

  const approve = async (args: ApproveCollateralArgs): Promise<{ hash: string }> => {
    setError(null);
    if (!walletClient?.account || !viemChain) {
      const msg = 'Wallet not connected';
      setError(msg);
      throw new Error(msg);
    }
    setStatus('approving');
    try {
      const client = makePublicClientForChain(viemChain.rpcUrls.default.http[0], [], viemChain);
      if (!client) throw new Error('Could not create RPC client');
      const { request } = await client.simulateContract({
        address: args.tokenAddress as `0x${string}`,
        abi: ExampleERC20.abi,
        functionName: 'approve',
        args: [args.homeAddress as `0x${string}`, args.amount],
        chain: viemChain,
        account: walletClient.account,
      });
      const writePromise = walletClient.writeContract(request);
      notify({ type: 'call', name: 'Approve Token' }, writePromise, viemChain);
      const hash = await writePromise;
      await client.waitForTransactionReceipt({ hash });
      return { hash };
    } catch (e: any) {
      const msg = e?.shortMessage ?? e?.message ?? 'Approve failed';
      setError(msg);
      throw e;
    } finally {
      setStatus('idle');
    }
  };

  const addCollateral = async (args: AddCollateralArgs): Promise<{ hash: string }> => {
    setError(null);
    if (!walletClient?.account || !viemChain) {
      const msg = 'Wallet not connected';
      setError(msg);
      throw new Error(msg);
    }
    if (args.amount === 0n) {
      const msg = 'Amount must be greater than zero';
      setError(msg);
      throw new Error(msg);
    }

    let remoteHex: string;
    try {
      remoteHex = cb58ToHex(args.remoteChainId);
    } catch {
      const msg = 'Could not encode remote chain ID';
      setError(msg);
      throw new Error(msg);
    }

    setStatus('depositing');
    try {
      const client = makePublicClientForChain(viemChain.rpcUrls.default.http[0], [], viemChain);
      if (!client) throw new Error('Could not create RPC client');

      const isNative = args.homeKind === 'native';
      // Native: amount is sent as `value`; the addCollateral signature
      // takes only (chainID, remote). ERC-20: amount is the third arg
      // and `value` is omitted.
      const callArgs = isNative
        ? [remoteHex, args.remoteAddress as `0x${string}`]
        : [remoteHex, args.remoteAddress as `0x${string}`, args.amount];

      const { request } = await client.simulateContract({
        address: args.homeAddress as `0x${string}`,
        abi: (isNative ? NativeTokenHomeABI.abi : ERC20TokenHomeABI.abi) as any,
        functionName: 'addCollateral',
        args: callArgs,
        chain: viemChain,
        account: walletClient.account,
        ...(isNative ? { value: args.amount } : {}),
      });
      const writePromise = walletClient.writeContract(request);
      notify({ type: 'call', name: 'Add Collateral' }, writePromise, viemChain);
      const hash = await writePromise;
      await client.waitForTransactionReceipt({ hash });
      return { hash };
    } catch (e: any) {
      const msg = e?.shortMessage ?? e?.message ?? 'Add collateral failed';
      setError(msg);
      throw e;
    } finally {
      setStatus('idle');
    }
  };

  return {
    approve,
    addCollateral,
    status,
    isApproving: status === 'approving',
    isDepositing: status === 'depositing',
    error,
    reset: () => setError(null),
  };
}
