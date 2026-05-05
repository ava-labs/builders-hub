'use client';

import { useCallback, useState } from 'react';
import { useAccount, usePublicClient } from 'wagmi';
import { formatUnits } from 'viem';
import { useResolvedWalletClient } from '@/components/toolbox/hooks/useResolvedWalletClient';
import { useEERCNotifiedWrite } from './useEERCNotifiedWrite';
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
  const notifiedWrite = useEERCNotifiedWrite();

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
        // Routes the ERC20 approval through the notified-write helper so
        // the console toast + tx-history row fire alongside every other
        // modern toolbox action. Replaces a raw walletClient.writeContract
        // that submitted silently to the user.
        const approveHash = await notifiedWrite(
          {
            address: token.address,
            abi: ERC20_MINIMAL_ABI as unknown as unknown[],
            functionName: 'approve',
            args: [deployment.encryptedERC, amountWei],
          },
          `Approve ${token.symbol} for encrypted-ERC`,
        );
        setStatus('confirming');
        await publicClient.waitForTransactionReceipt({ hash: approveHash });
        await refreshAllowance();
        setStatus('idle');
        return approveHash;
      } catch (err) {
        setStatus('error');
        setError(err instanceof Error ? err.message : 'Approval failed');
        return null;
      }
    },
    [address, deployment, token, walletClient, publicClient, refreshAllowance, notifiedWrite],
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
        const human = formatUnits(amountWei, token.decimals);
        const result = await depositToEERC({
          deployment,
          token,
          amountWei,
          userPublicKey: identity.publicKey,
          writeContract: (args) => notifiedWrite(args, `Deposit ${human} ${token.symbol} to encrypted-ERC`),
        });

        setLastCents(result.cents);
        setLastDustWei(result.dustWei);
        setTxHash(result.txHash);

        setStatus('confirming');
        await publicClient.waitForTransactionReceipt({ hash: result.txHash });
        // EncryptedERC.deposit() consumes the user's allowance via
        // transferFrom, so the cached `currentAllowance` is now stale.
        // Re-read it before exposing the success state — without this,
        // `hasAllowance` stays true on the consuming UI and the deposit
        // button would remain enabled even though a follow-up deposit
        // would now hit `Insufficient allowance` on the contract.
        await refreshAllowance();
        setStatus('success');

        return result.txHash;
      } catch (err) {
        setStatus('error');
        setError(err instanceof Error ? err.message : 'Deposit failed');
        return null;
      }
    },
    [address, deployment, token, walletClient, publicClient, refreshAllowance, notifiedWrite],
  );

  return { status, error, txHash, lastCents, lastDustWei, currentAllowance, refreshAllowance, approve, deposit, preview };
}
