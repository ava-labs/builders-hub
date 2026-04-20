'use client';

import { useCallback, useState } from 'react';
import { useAccount, usePublicClient } from 'wagmi';
import { useResolvedWalletClient } from '@/components/toolbox/hooks/useResolvedWalletClient';
import { withdrawFromEERC } from '@/lib/eerc/operations/withdraw';
import { loadIdentity } from '@/lib/eerc/identity';
import type { BJPoint } from '@/lib/eerc/crypto/babyjub';
import type { FlatEncryptedBalance } from '@/lib/eerc/operations/transfer';
import type { EERCDeployment, Hex } from '@/lib/eerc/types';

export type WithdrawStatus = 'idle' | 'proving' | 'submitting' | 'confirming' | 'success' | 'error';

export interface UseEERCWithdrawState {
  status: WithdrawStatus;
  error: string | null;
  txHash: Hex | null;
  withdraw: (args: {
    amountCents: bigint;
    encryptedBalance: FlatEncryptedBalance;
    decryptedBalance: bigint;
    auditorPublicKey: BJPoint;
    tokenId: bigint;
  }) => Promise<Hex | null>;
}

export function useEERCWithdraw(deployment: EERCDeployment | undefined): UseEERCWithdrawState {
  const { address } = useAccount();
  const publicClient = usePublicClient();
  const walletClient = useResolvedWalletClient();

  const [status, setStatus] = useState<WithdrawStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<Hex | null>(null);

  const withdraw: UseEERCWithdrawState['withdraw'] = useCallback(
    async ({ amountCents, encryptedBalance, decryptedBalance, auditorPublicKey, tokenId }) => {
      if (!address || !deployment || !walletClient || !publicClient) {
        throw new Error('Wallet not connected or deployment not resolved');
      }
      const identity = loadIdentity(address, deployment.registrar);
      if (!identity) throw new Error('Register your BabyJubJub identity first');

      setError(null);
      setTxHash(null);

      try {
        setStatus('proving');
        const result = await withdrawFromEERC({
          deployment,
          senderAddress: address as Hex,
          senderPrivateKey: identity.formattedKey,
          senderPublicKey: identity.publicKey,
          auditorPublicKey,
          encryptedBalance,
          decryptedBalance,
          amount: amountCents,
          tokenId,
          writeContract: async (args) => {
            setStatus('submitting');
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
        setTxHash(result.txHash);
        setStatus('confirming');
        await publicClient.waitForTransactionReceipt({ hash: result.txHash });
        setStatus('success');
        return result.txHash;
      } catch (err) {
        setStatus('error');
        setError(err instanceof Error ? err.message : 'Withdraw failed');
        return null;
      }
    },
    [address, deployment, walletClient, publicClient],
  );

  return { status, error, txHash, withdraw };
}
