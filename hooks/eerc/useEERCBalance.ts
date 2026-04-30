'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAccount, usePublicClient } from 'wagmi';
import EncryptedERCArtifact from '@/contracts/encrypted-erc/compiled/EncryptedERC.json';
import { Poseidon } from '@/lib/eerc/crypto';
import { Scalar } from '@/lib/eerc/crypto/scalar';
import { loadIdentity, type EERCIdentitySecret } from '@/lib/eerc/identity';
import type { EERCDeployment, ERC20Meta, Hex } from '@/lib/eerc/types';

type RawEGCT = readonly [readonly [bigint, bigint], readonly [bigint, bigint]]; // (c1, c2)
type RawAmountPCT = readonly [readonly [bigint, bigint, bigint, bigint, bigint, bigint, bigint], bigint]; // (pct[7], index)

/** Raw shape returned by the contract's `balanceOfStandalone` / `getBalanceFromTokenAddress`. */
interface RawBalance {
  eGCT: { c1: readonly [bigint, bigint]; c2: readonly [bigint, bigint] };
  nonce: bigint;
  amountPCTs: readonly RawAmountPCT[];
  balancePCT: readonly [bigint, bigint, bigint, bigint, bigint, bigint, bigint];
  transactionIndex: bigint;
}

export interface EERCBalanceState {
  /** Decrypted balance in eERC units (2 decimals). Null when we can't decrypt. */
  decryptedCents: bigint | null;
  /** Human-readable balance string ("12.34") when decrypted, else null. */
  formatted: string | null;
  raw: RawBalance | null;
  isLoading: boolean;
  error: string | null;
  /** True when a BJJ identity is cached but hasn't been registered on-chain. */
  hasIdentity: boolean;
  /** Reload from the chain. */
  refresh: () => Promise<void>;
}

/**
 * Resolve + decrypt the encrypted balance of the connected user on a given
 * eERC deployment. For converter mode, pass the source ERC20 metadata so
 * we know which `getBalanceFromTokenAddress` call to make.
 */
export function useEERCBalance(
  deployment: EERCDeployment | undefined,
  mode: 'standalone' | 'converter',
  token?: ERC20Meta,
): EERCBalanceState {
  const { address } = useAccount();
  const publicClient = usePublicClient();
  const [state, setState] = useState<Pick<EERCBalanceState, 'decryptedCents' | 'formatted' | 'raw' | 'isLoading' | 'error'>>({
    decryptedCents: null,
    formatted: null,
    raw: null,
    isLoading: false,
    error: null,
  });
  const [identity, setIdentity] = useState<EERCIdentitySecret | null>(null);

  useEffect(() => {
    if (!address || !deployment) {
      setIdentity(null);
      setState({
        decryptedCents: null,
        formatted: null,
        raw: null,
        isLoading: false,
        error: null,
      });
      return;
    }
    setIdentity(loadIdentity(address, deployment.registrar));
  }, [address, deployment]);

  const refresh = useCallback(async () => {
    if (!address || !deployment || !publicClient) return;
    if (mode === 'converter' && !token) {
      setState((s) => ({ ...s, error: 'No token selected for converter mode' }));
      return;
    }

    const currentIdentity = loadIdentity(address, deployment.registrar);
    setIdentity(currentIdentity);
    setState((s) => ({ ...s, isLoading: true, error: null }));

    try {
      const raw = (await publicClient.readContract({
        address: deployment.encryptedERC,
        abi: EncryptedERCArtifact.abi,
        functionName: mode === 'standalone' ? 'balanceOfStandalone' : 'getBalanceFromTokenAddress',
        args: mode === 'standalone' ? [address] : [address, token!.address],
      })) as readonly [
        { c1: readonly [bigint, bigint]; c2: readonly [bigint, bigint] },
        bigint,
        readonly RawAmountPCT[],
        readonly [bigint, bigint, bigint, bigint, bigint, bigint, bigint],
        bigint,
      ];

      const asStruct: RawBalance = {
        eGCT: raw[0],
        nonce: raw[1],
        amountPCTs: raw[2],
        balancePCT: raw[3],
        transactionIndex: raw[4],
      };

      // True balance in eERC = decrypt(balancePCT) + sum(decrypt(amountPCT)).
      //
      //   - balancePCT is the snapshot the user proved against at their last
      //     outgoing op (transfer/withdraw). All-zero on a fresh account.
      //   - amountPCTs[] accumulates incoming deposits and transfers since
      //     then; the contract clears it whenever the user submits a fresh
      //     balancePCT (i.e., on transfer/withdraw).
      //
      // Earlier versions only decrypted balancePCT, so a user who had only
      // deposited (balancePCT still all-zero) saw 0. We now sum both
      // components so the deposit-only path reports correctly.
      const allZeroBalancePct = asStruct.balancePCT.every((x) => x === 0n);

      let decryptedCents: bigint | null = null;
      if (currentIdentity) {
        let total = 0n;
        let anyDecryptSucceeded = false;

        // Component 1: balancePCT (the running-balance snapshot). Skip the
        // decrypt call entirely on all-zero — Poseidon's integrity check
        // throws on a zeroed ciphertext.
        if (!allZeroBalancePct) {
          try {
            total += Poseidon.decryptAmountPCT(
              currentIdentity.decryptionKey,
              asStruct.balancePCT.map((x) => x.toString()),
            );
            anyDecryptSucceeded = true;
          } catch {
            // balancePCT didn't decrypt to our key — leave total alone and
            // hope the amountPCTs path picks up the real balance. Common
            // failure mode: stale identity from a previous registration.
          }
        } else {
          // All-zero balancePCT is the legitimate fresh-account state, not
          // a decrypt failure. Treat it as a successful zero contribution.
          anyDecryptSucceeded = true;
        }

        // Component 2: amountPCTs[] — incoming deposits/transfers since the
        // last outgoing op. Each entry is `(pct[7], txIndex)`; we only need
        // the pct[7] portion. Sum every entry that successfully decrypts.
        for (const [pctArr] of asStruct.amountPCTs) {
          try {
            total += Poseidon.decryptAmountPCT(
              currentIdentity.decryptionKey,
              pctArr.map((x) => x.toString()),
            );
            anyDecryptSucceeded = true;
          } catch {
            // Skip entries that aren't encrypted to our key. Shouldn't
            // happen in practice (the contract gates by msg.sender), but
            // a stray entry shouldn't blank the whole balance.
          }
        }

        decryptedCents = anyDecryptSucceeded ? total : null;
      }

      setState({
        decryptedCents,
        formatted: decryptedCents === null ? null : Scalar.parseEERCBalance(decryptedCents),
        raw: asStruct,
        isLoading: false,
        error: null,
      });
    } catch (err) {
      setState((s) => ({
        ...s,
        isLoading: false,
        error: err instanceof Error ? err.message : 'Failed to read balance',
      }));
    }
  }, [address, deployment, publicClient, mode, token]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return {
    ...state,
    hasIdentity: identity !== null,
    refresh,
  };
}
