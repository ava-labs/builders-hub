'use client';

import { useCallback, useState } from 'react';
import { useAccount, usePublicClient } from 'wagmi';
import { useResolvedWalletClient } from '@/components/toolbox/hooks/useResolvedWalletClient';
import RegistrarArtifact from '@/contracts/encrypted-erc/compiled/Registrar.json';
import { transferPrivate, type FlatEncryptedBalance } from '@/lib/eerc/operations/transfer';
import { loadIdentity } from '@/lib/eerc/identity';
import type { BJPoint } from '@/lib/eerc/crypto/babyjub';
import type { EERCDeployment, ERC20Meta, Hex } from '@/lib/eerc/types';

export type TransferStatus = 'idle' | 'lookup' | 'proving' | 'submitting' | 'confirming' | 'success' | 'error';

export interface UseEERCTransferState {
  status: TransferStatus;
  error: string | null;
  txHash: Hex | null;
  transfer: (args: {
    to: Hex;
    amountCents: bigint;
    encryptedBalance: FlatEncryptedBalance;
    decryptedBalance: bigint;
    auditorPublicKey: BJPoint;
    tokenId: bigint;
  }) => Promise<Hex | null>;
}

/**
 * Orchestrates the full private-transfer tx. The caller feeds in already-read
 * encrypted balance + auditor key (from useEERCBalance + useEERCAuditorAndTokenId)
 * rather than re-reading them here, so the hook stays focused on the write path.
 */
export function useEERCTransfer(deployment: EERCDeployment | undefined): UseEERCTransferState {
  const { address } = useAccount();
  const publicClient = usePublicClient();
  const walletClient = useResolvedWalletClient();

  const [status, setStatus] = useState<TransferStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<Hex | null>(null);

  const transfer: UseEERCTransferState['transfer'] = useCallback(
    async ({ to, amountCents, encryptedBalance, decryptedBalance, auditorPublicKey, tokenId }) => {
      if (!address || !deployment || !walletClient || !publicClient) {
        throw new Error('Wallet not connected or deployment not resolved');
      }
      const identity = loadIdentity(address, deployment.registrar);
      if (!identity) throw new Error('Register your BabyJubJub identity first');

      setError(null);
      setTxHash(null);

      try {
        setStatus('lookup');
        // Recipient must be registered — fetch their pubkey from Registrar.
        const recipientPkArr = (await publicClient.readContract({
          address: deployment.registrar,
          abi: RegistrarArtifact.abi,
          functionName: 'getUserPublicKey',
          args: [to],
        })) as readonly [bigint, bigint];
        if (recipientPkArr[0] === 0n && recipientPkArr[1] === 0n) {
          throw new Error('Recipient is not registered on this eERC Registrar');
        }

        setStatus('proving');
        const result = await transferPrivate({
          deployment,
          senderAddress: address as Hex,
          senderPrivateKey: identity.formattedKey,
          senderPublicKey: identity.publicKey,
          recipientAddress: to,
          recipientPublicKey: [recipientPkArr[0], recipientPkArr[1]],
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
        setError(err instanceof Error ? err.message : 'Transfer failed');
        return null;
      }
    },
    [address, deployment, walletClient, publicClient],
  );

  return { status, error, txHash, transfer };
}
