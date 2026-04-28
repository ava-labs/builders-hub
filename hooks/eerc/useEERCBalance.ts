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

      // If the whole balancePCT is zero, the user has never received funds on this (mode,token).
      // Don't try to decrypt — Poseidon.decryptAmountPCT would throw on the ciphertext integrity check.
      const allZero = asStruct.balancePCT.every((x) => x === 0n);

      let decryptedCents: bigint | null = null;
      if (!allZero && currentIdentity) {
        try {
          decryptedCents = Poseidon.decryptAmountPCT(
            currentIdentity.decryptionKey,
            asStruct.balancePCT.map((x) => x.toString()),
          );
        } catch (err) {
          // Integrity-check failure almost always means "this PCT wasn't
          // encrypted to your key" — surface politely rather than as crash.
          decryptedCents = null;
        }
      } else if (allZero) {
        decryptedCents = 0n;
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
