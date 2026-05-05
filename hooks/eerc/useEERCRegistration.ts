'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAccount, usePublicClient } from 'wagmi';
import { useResolvedWalletClient } from '@/components/toolbox/hooks/useResolvedWalletClient';
import { useEERCNotifiedWrite } from './useEERCNotifiedWrite';
import { registerOnChain } from '@/lib/eerc/register';
import {
  loadIdentity,
  saveIdentity,
  clearIdentity,
  deriveIdentity as deriveIdentityFromWallet,
  type EERCIdentitySecret,
} from '@/lib/eerc/identity';
import RegistrarArtifact from '@/contracts/encrypted-erc/compiled/Registrar.json';
import type { Hex, EERCDeployment } from '@/lib/eerc/types';

export type RegistrationStatus =
  | 'idle'               // no deployment resolved yet
  | 'checking'           // reading Registrar to see if user is registered
  | 'not-registered'     // ready to register
  | 'deriving-key'       // waiting on wallet signature
  | 'proving'            // generating Groth16 registration proof
  | 'submitting'         // register() tx pending
  | 'registered'         // success — publicKey on-chain
  | 'error';

export interface UseEERCRegistrationState {
  status: RegistrationStatus;
  error: string | null;
  /** The BJJ identity currently loaded for this (address, registrar). */
  identity: EERCIdentitySecret | null;
  /** The on-chain public key returned by Registrar.getUserPublicKey (0 pair if not registered). */
  onChainPublicKey: [bigint, bigint] | null;
  /** Kick off the full register() flow. Resolves with tx hash on success. */
  register: () => Promise<Hex>;
  /** Wipe the cached BJJ identity for this (address, registrar) from localStorage. */
  resetIdentity: () => void;
  /**
   * Re-derive the BJJ identity from a fresh wallet signature and cache it
   * locally without touching the on-chain registration. Used by the
   * RegisteredPanel when the user has already registered but their local
   * key cache was cleared (Reset Console State, new browser, etc.).
   */
  deriveIdentity: () => Promise<void>;
}

/**
 * Orchestrates the registration lifecycle for the currently connected wallet
 * against a specific eERC deployment. Handles reading registration state,
 * caching the derived BJJ identity in localStorage, and driving the tx.
 */
export function useEERCRegistration(deployment: EERCDeployment | undefined): UseEERCRegistrationState {
  const { address } = useAccount();
  const publicClient = usePublicClient();
  const walletClient = useResolvedWalletClient();
  const notifiedWrite = useEERCNotifiedWrite();

  const [status, setStatus] = useState<RegistrationStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [identity, setIdentity] = useState<EERCIdentitySecret | null>(null);
  const [onChainPublicKey, setOnChainPublicKey] = useState<[bigint, bigint] | null>(null);

  const refresh = useCallback(async () => {
    if (!address || !publicClient || !deployment) {
      setStatus('idle');
      return;
    }
    setStatus('checking');
    setError(null);
    try {
      const key = (await publicClient.readContract({
        address: deployment.registrar,
        abi: RegistrarArtifact.abi,
        functionName: 'getUserPublicKey',
        args: [address],
      })) as readonly [bigint, bigint];

      const isRegistered = key[0] !== 0n && key[1] !== 0n;
      setOnChainPublicKey([key[0], key[1]]);

      const cached = loadIdentity(address, deployment.registrar);
      setIdentity(cached);

      setStatus(isRegistered ? 'registered' : 'not-registered');
    } catch (err) {
      setStatus('error');
      setError(err instanceof Error ? err.message : 'Failed to read registration state');
    }
  }, [address, publicClient, deployment]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const register = useCallback(async (): Promise<Hex> => {
    if (!address || !walletClient || !deployment) {
      throw new Error('Wallet not connected or deployment not ready');
    }
    const chainId = await walletClient.getChainId();
    setError(null);

    try {
      setStatus('deriving-key');
      // The register helper handles key derivation + proof internally; we
      // interleave status transitions so the UI reflects the right stage
      // at each await point. We cast the wallet client to `any` for the
      // writeContract / signMessage calls: viem's strict generics require
      // per-call abi type-params that we deliberately erase at our helper
      // boundary to keep the register module framework-agnostic.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const wc = walletClient as any;
      const signMessage = async (message: string) => {
        const sig = await wc.signMessage({ message });
        setStatus('proving');
        return sig as Hex;
      };

      const writeContract = async (args: {
        address: Hex;
        abi: unknown[];
        functionName: 'register';
        args: unknown[];
      }) => {
        setStatus('submitting');
        // Routes the registrar `register()` tx through the canonical
        // notified-write helper so it shows up in the console toast +
        // tx history alongside every other modern toolbox action.
        return await notifiedWrite(args, 'Register encrypted-ERC identity');
      };

      const result = await registerOnChain({
        address: address as Hex,
        chainId,
        registrarAddress: deployment.registrar,
        signMessage,
        writeContract,
      });

      // Persist the derived identity so subsequent sessions skip the sign step.
      saveIdentity(address, deployment.registrar, result.identity);
      setIdentity(result.identity);

      // Wait for receipt so the Registered state reflects on-chain truth.
      if (publicClient) {
        await publicClient.waitForTransactionReceipt({ hash: result.txHash });
        await refresh();
      } else {
        setStatus('registered');
      }

      return result.txHash;
    } catch (err) {
      setStatus('error');
      setError(err instanceof Error ? err.message : 'Registration failed');
      throw err;
    }
  }, [address, walletClient, publicClient, deployment, refresh]);

  const resetIdentity = useCallback(() => {
    if (!address || !deployment) return;
    clearIdentity(address, deployment.registrar);
    setIdentity(null);
  }, [address, deployment]);

  const deriveIdentity = useCallback(async (): Promise<void> => {
    if (!address || !walletClient || !deployment) {
      throw new Error('Wallet not connected or deployment not ready');
    }
    setError(null);
    try {
      // Cast away viem's strict per-call abi generics at this boundary so
      // the lib helper stays framework-agnostic.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const wc = walletClient as any;
      const secret = await deriveIdentityFromWallet(
        address as `0x${string}`,
        async (message: string) => (await wc.signMessage({ message })) as Hex,
      );
      saveIdentity(address, deployment.registrar, secret);
      setIdentity(secret);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to derive identity');
      throw err;
    }
  }, [address, walletClient, deployment]);

  return { status, error, identity, onChainPublicKey, register, resetIdentity, deriveIdentity };
}
