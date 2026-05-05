'use client';

import { useCallback, useState } from 'react';
import { useAccount, usePublicClient } from 'wagmi';
import { useResolvedWalletClient } from '@/components/toolbox/hooks/useResolvedWalletClient';
import { useEERCNotifiedWrite } from './useEERCNotifiedWrite';
import { withdrawFromEERC } from '@/lib/eerc/operations/withdraw';
import { Scalar } from '@/lib/eerc/crypto/scalar';
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

export interface UseEERCWithdrawOptions {
  /**
   * Fired after the on-chain withdraw is confirmed but before the hook flips
   * to the 'success' state. Failures are swallowed so a refresh hiccup never
   * blanks a successful tx.
   */
  onConfirmed?: () => void | Promise<void>;
}

export function useEERCWithdraw(
  deployment: EERCDeployment | undefined,
  options?: UseEERCWithdrawOptions,
): UseEERCWithdrawState {
  const { address } = useAccount();
  const publicClient = usePublicClient();
  const walletClient = useResolvedWalletClient();
  const notifiedWrite = useEERCNotifiedWrite();
  const onConfirmed = options?.onConfirmed;

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

      const human = Scalar.parseEERCBalance(amountCents);
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
            return await notifiedWrite(args, `Withdraw ${human} from encrypted-ERC`);
          },
        });
        setTxHash(result.txHash);
        setStatus('confirming');
        await publicClient.waitForTransactionReceipt({ hash: result.txHash });
        // Refresh dependent on-chain state (balance, auditor) before flipping
        // to 'success'. Without this, the UI keeps showing the pre-withdraw
        // ciphertext until the user manually reloads.
        try {
          await onConfirmed?.();
        } catch {
          // A refresh failure must not turn a confirmed tx into an error.
        }
        setStatus('success');
        return result.txHash;
      } catch (err) {
        setStatus('error');
        setError(err instanceof Error ? err.message : 'Withdraw failed');
        return null;
      }
    },
    [address, deployment, walletClient, publicClient, notifiedWrite, onConfirmed],
  );

  return { status, error, txHash, withdraw };
}
