'use client';

import { useCallback, useState } from 'react';
import { useAccount, usePublicClient } from 'wagmi';
import { useResolvedWalletClient } from '@/components/toolbox/hooks/useResolvedWalletClient';
import { depositToEERC, ERC20_MINIMAL_ABI, computeDepositCents } from '@/lib/eerc/operations/deposit';
import { loadIdentity } from '@/lib/eerc/identity';
import type { EERCDeployment, ERC20Meta, Hex } from '@/lib/eerc/types';

export type DepositStatus = 'idle' | 'checking-allowance' | 'approving' | 'depositing' | 'confirming' | 'success' | 'error';

export interface UseEERCDepositState {
  status: DepositStatus;
  error: string | null;
  txHash: Hex | null;
  lastCents: bigint | null;
  lastDustWei: bigint | null;
  currentAllowance: bigint | null;
  refreshAllowance: () => Promise<bigint | null>;
  approve: (amountWei: bigint) => Promise<Hex | null>;
  /** Submit the encrypted deposit. Requires allowance to already cover amountWei. */
  deposit: (amountWei: bigint) => Promise<Hex | null>;
  /** Compute expected cents + dust for a given wei input without submitting. */
  preview: (amountWei: bigint) => ReturnType<typeof computeDepositCents>;
}

export function useEERCDeposit(deployment: EERCDeployment | undefined, token: ERC20Meta | undefined): UseEERCDepositState {
  const { address } = useAccount();
  const publicClient = usePublicClient();
  const walletClient = useResolvedWalletClient();

  const [status, setStatus] = useState<DepositStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<Hex | null>(null);
  const [lastCents, setLastCents] = useState<bigint | null>(null);
  const [lastDustWei, setLastDustWei] = useState<bigint | null>(null);
  const [currentAllowance, setCurrentAllowance] = useState<bigint | null>(null);

  const preview = useCallback(
    (amountWei: bigint) => {
      if (!deployment || !token) return { cents: 0n, dustWei: 0n };
      return computeDepositCents(amountWei, token.decimals, deployment.decimals);
    },
    [deployment, token],
  );

  const refreshAllowance = useCallback(async (): Promise<bigint | null> => {
    if (!address || !deployment || !token || !publicClient) return null;
    const allowance = (await publicClient.readContract({
      address: token.address,
      abi: ERC20_MINIMAL_ABI,
      functionName: 'allowance',
      args: [address, deployment.encryptedERC],
    })) as bigint;
    setCurrentAllowance(allowance);
    return allowance;
  }, [address, deployment, token, publicClient]);

  const approve = useCallback(
    async (amountWei: bigint): Promise<Hex | null> => {
      if (!address || !deployment || !token || !walletClient || !publicClient) {
        throw new Error('Wallet not connected or deployment/token not resolved');
      }
      setError(null);
      setTxHash(null);

      try {
        setStatus('approving');
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const approveHash = await (walletClient as any).writeContract({
          address: token.address,
          abi: ERC20_MINIMAL_ABI,
          functionName: 'approve',
          args: [deployment.encryptedERC, amountWei],
        });
        setStatus('confirming');
        await publicClient.waitForTransactionReceipt({ hash: approveHash });
        await refreshAllowance();
        setStatus('idle');
        return approveHash as Hex;
      } catch (err) {
        setStatus('error');
        setError(err instanceof Error ? err.message : 'Approval failed');
        return null;
      }
    },
    [address, deployment, token, walletClient, publicClient, refreshAllowance],
  );

  const deposit = useCallback(
    async (amountWei: bigint): Promise<Hex | null> => {
      if (!address || !deployment || !token || !walletClient || !publicClient) {
        throw new Error('Wallet not connected or deployment/token not resolved');
      }
      const identity = loadIdentity(address, deployment.registrar);
      if (!identity) throw new Error('Register your BabyJubJub identity first');

      setError(null);
      setTxHash(null);

      try {
        setStatus('checking-allowance');
        const allowance = await refreshAllowance();
        if (allowance !== null && allowance < amountWei) {
          throw new Error('Approve WAVAX before depositing.');
        }

        setStatus('depositing');
        const result = await depositToEERC({
          deployment,
          token,
          amountWei,
          userPublicKey: identity.publicKey,
          writeContract: async (args) => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const h = await (walletClient as any).writeContract({
              address: args.address,
              abi: args.abi,
              functionName: args.functionName,
              args: args.args,
            });
            return h as Hex;
          },
        });

        setLastCents(result.cents);
        setLastDustWei(result.dustWei);
        setTxHash(result.txHash);

        setStatus('confirming');
        await publicClient.waitForTransactionReceipt({ hash: result.txHash });
        setStatus('success');

        return result.txHash;
      } catch (err) {
        setStatus('error');
        setError(err instanceof Error ? err.message : 'Deposit failed');
        return null;
      }
    },
    [address, deployment, token, walletClient, publicClient, refreshAllowance],
  );

  return { status, error, txHash, lastCents, lastDustWei, currentAllowance, refreshAllowance, approve, deposit, preview };
}
