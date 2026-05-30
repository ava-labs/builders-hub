'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAccount, usePublicClient } from 'wagmi';
import EncryptedERCArtifact from '@/contracts/encrypted-erc/compiled/EncryptedERC.json';
import { Scalar } from '@/lib/eerc/crypto/scalar';
import { loadIdentity, type EERCIdentitySecret } from '@/lib/eerc/identity';
import {
  validateEERCBalance,
  type EERCPCT,
  type RawEERCAmountPCT,
  type RawEERCBalance,
} from '@/lib/eerc/balanceValidation';
import type { EERCDeployment, ERC20Meta } from '@/lib/eerc/types';

export interface EERCBalanceState {
  /** Decrypted balance in eERC units (2 decimals). Null when we can't decrypt. */
  decryptedCents: bigint | null;
  /** Human-readable balance string ("12.34") when decrypted, else null. */
  formatted: string | null;
  raw: RawEERCBalance | null;
  isLoading: boolean;
  error: string | null;
  /** Set when the balance ciphertext is readable but unsafe to spend. */
  validationError: string | null;
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
  const [state, setState] = useState<
    Pick<EERCBalanceState, 'decryptedCents' | 'formatted' | 'raw' | 'isLoading' | 'error' | 'validationError'>
  >({
    decryptedCents: null,
    formatted: null,
    raw: null,
    isLoading: false,
    error: null,
    validationError: null,
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
        validationError: null,
      });
      return;
    }
    setIdentity(loadIdentity(address, deployment.registrar));
  }, [address, deployment]);

  const refresh = useCallback(async () => {
    if (!address || !deployment || !publicClient) return;
    if (mode === 'converter' && !token) {
      setState((s) => ({ ...s, error: 'No token selected for converter mode', validationError: null }));
      return;
    }

    const currentIdentity = loadIdentity(address, deployment.registrar);
    setIdentity(currentIdentity);
    setState((s) => ({ ...s, isLoading: true, error: null, validationError: null }));

    try {
      const raw = (await publicClient.readContract({
        address: deployment.encryptedERC,
        abi: EncryptedERCArtifact.abi,
        functionName: mode === 'standalone' ? 'balanceOfStandalone' : 'getBalanceFromTokenAddress',
        args: mode === 'standalone' ? [address] : [address, token!.address],
      })) as readonly [
        { c1: { x: bigint; y: bigint } | readonly [bigint, bigint]; c2: { x: bigint; y: bigint } | readonly [bigint, bigint] },
        bigint,
        readonly RawEERCAmountPCT[],
        EERCPCT,
        bigint,
      ];

      // Normalize the EG ciphertext points from viem's named-field shape
      // (`{x, y}`) to the tuple shape (`[x, y]`) every consumer in the
      // codebase expects (`balance.raw.eGCT.c1[0]`). The Solidity ABI
      // declares each Point as a struct with named fields, so viem
      // returns nested points as objects. Fall back to tuple shape on
      // older viem responses just in case.
      const normalizePoint = (p: { x: bigint; y: bigint } | readonly [bigint, bigint]): readonly [bigint, bigint] => {
        if (Array.isArray(p)) return [(p as readonly bigint[])[0]!, (p as readonly bigint[])[1]!];
        const obj = p as { x: bigint; y: bigint };
        return [obj.x, obj.y];
      };

      const asStruct: RawEERCBalance = {
        eGCT: {
          c1: normalizePoint(raw[0].c1),
          c2: normalizePoint(raw[0].c2),
        },
        nonce: raw[1],
        amountPCTs: raw[2],
        balancePCT: raw[3],
        transactionIndex: raw[4],
      };

      let decryptedCents: bigint | null = null;
      let validationError: string | null = null;
      if (currentIdentity) {
        const validation = validateEERCBalance(asStruct, currentIdentity);
        if (validation.ok) {
          decryptedCents = validation.decryptedCents;
        } else {
          validationError = validation.message;
        }
      }

      setState({
        decryptedCents,
        formatted: decryptedCents === null ? null : Scalar.parseEERCBalance(decryptedCents),
        raw: asStruct,
        isLoading: false,
        error: validationError,
        validationError,
      });
    } catch (err) {
      setState({
        decryptedCents: null,
        formatted: null,
        raw: null,
        isLoading: false,
        error: err instanceof Error ? err.message : 'Failed to read balance',
        validationError: null,
      });
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
