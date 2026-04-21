'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAccount, usePublicClient } from 'wagmi';
import { getAbiItem, type AbiEvent } from 'viem';
import EncryptedERCArtifact from '@/contracts/encrypted-erc/compiled/EncryptedERC.json';
import { Poseidon, Scalar } from '@/lib/eerc/crypto';
import { loadIdentity } from '@/lib/eerc/identity';
import type { EERCDeployment, Hex } from '@/lib/eerc/types';

export interface AuditorEntry {
  kind: 'PrivateTransfer' | 'PrivateMint' | 'PrivateBurn';
  txHash: Hex;
  blockNumber: bigint;
  /** Sender / recipient of the underlying transfer (or minted-to / burned-from). */
  from: Hex | null;
  to: Hex | null;
  /** The auditor EOA recorded in the event — should match the currently-set auditor. */
  auditorAddress: Hex;
  /** Decrypted amount, in eERC cents. Null when decryption with the supplied key fails. */
  amount: bigint | null;
  amountFormatted: string | null;
  /** Raw PCT values — shown in the expandable detail panel. */
  rawPCT: readonly bigint[];
}

export interface UseAuditorEventsState {
  entries: AuditorEntry[];
  isLoading: boolean;
  error: string | null;
  /** The decryption key currently in use — loaded from localStorage or user-supplied. */
  decryptionKey: string | null;
  auditorAddressOnChain: Hex | null;
  setDecryptionKey: (k: string | null) => void;
  refresh: () => Promise<void>;
}

const abi = EncryptedERCArtifact.abi as AbiEvent[];
const transferEvent = getAbiItem({ abi, name: 'PrivateTransfer' }) as AbiEvent;
const mintEvent = getAbiItem({ abi, name: 'PrivateMint' }) as AbiEvent;
const burnEvent = getAbiItem({ abi, name: 'PrivateBurn' }) as AbiEvent;

/**
 * Fetch every PrivateTransfer/Mint/Burn event on a deployment and attempt to
 * decrypt each auditor PCT with the supplied BabyJubJub private key.
 *
 * Entries where decryption fails (wrong key, or PCT encrypted to a previously-
 * rotated auditor) come through with amount: null — we surface them anyway so
 * the auditor can see gaps in their coverage.
 */
export function useAuditorEvents(deployment: EERCDeployment | undefined): UseAuditorEventsState {
  const { address } = useAccount();
  const publicClient = usePublicClient();
  const [entries, setEntries] = useState<AuditorEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [decryptionKey, setDecryptionKey] = useState<string | null>(null);
  const [auditorAddressOnChain, setAuditorAddressOnChain] = useState<Hex | null>(null);

  // Auto-load the cached identity when the connected wallet IS the on-chain auditor.
  useEffect(() => {
    if (!address || !deployment || !publicClient) return;
    (async () => {
      try {
        const auditor = (await publicClient.readContract({
          address: deployment.encryptedERC,
          abi: EncryptedERCArtifact.abi,
          functionName: 'auditor',
          args: [],
        })) as Hex;
        setAuditorAddressOnChain(auditor);
        if (auditor && auditor.toLowerCase() === address.toLowerCase()) {
          const cached = loadIdentity(address, deployment.registrar);
          if (cached) setDecryptionKey(cached.decryptionKey);
        }
      } catch {
        /* ignore */
      }
    })();
  }, [address, deployment, publicClient]);

  const fetchAll = useCallback(async () => {
    if (!publicClient || !deployment) return;
    setIsLoading(true);
    setError(null);
    try {
      // Fuji's public RPC caps eth_getLogs at 2048 blocks per call. Chunk the
      // range from deployedAtBlock → latest into pages below that limit.
      const CHUNK = 2000n;
      const fromBlock = deployment.deployedAtBlock ? BigInt(deployment.deployedAtBlock) : 0n;
      const latest = await publicClient.getBlockNumber();

      type FetchedLogs = Awaited<ReturnType<typeof publicClient.getLogs>>;
      const transfers: FetchedLogs = [];
      const mints: FetchedLogs = [];
      const burns: FetchedLogs = [];
      for (let cur = fromBlock; cur <= latest; cur += CHUNK + 1n) {
        const end = cur + CHUNK > latest ? latest : cur + CHUNK;
        const [t, m, b] = await Promise.all([
          publicClient.getLogs({ address: deployment.encryptedERC, event: transferEvent, fromBlock: cur, toBlock: end }),
          publicClient.getLogs({ address: deployment.encryptedERC, event: mintEvent, fromBlock: cur, toBlock: end }),
          publicClient.getLogs({ address: deployment.encryptedERC, event: burnEvent, fromBlock: cur, toBlock: end }),
        ]);
        transfers.push(...t);
        mints.push(...m);
        burns.push(...b);
      }

      type RawLog = (typeof transfers)[number] & {
        args: { from?: Hex; to?: Hex; user?: Hex; auditorPCT: readonly bigint[]; auditorAddress: Hex };
      };

      const mapLog = (kind: AuditorEntry['kind'], log: RawLog): AuditorEntry => {
        const rawPCT = log.args.auditorPCT;
        let amount: bigint | null = null;
        if (decryptionKey) {
          try {
            amount = Poseidon.decryptAmountPCT(decryptionKey, rawPCT.map((x) => x.toString()));
          } catch {
            amount = null;
          }
        }
        return {
          kind,
          txHash: log.transactionHash as Hex,
          blockNumber: log.blockNumber ?? 0n,
          from: kind === 'PrivateTransfer' ? log.args.from ?? null : kind === 'PrivateBurn' ? log.args.user ?? null : null,
          to: kind === 'PrivateTransfer' ? log.args.to ?? null : kind === 'PrivateMint' ? log.args.user ?? null : null,
          auditorAddress: log.args.auditorAddress,
          amount,
          amountFormatted: amount === null ? null : Scalar.parseEERCBalance(amount),
          rawPCT,
        };
      };

      const all: AuditorEntry[] = [
        ...transfers.map((l) => mapLog('PrivateTransfer', l as unknown as RawLog)),
        ...mints.map((l) => mapLog('PrivateMint', l as unknown as RawLog)),
        ...burns.map((l) => mapLog('PrivateBurn', l as unknown as RawLog)),
      ].sort((a, b) => Number(b.blockNumber - a.blockNumber));

      setEntries(all);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch events');
    } finally {
      setIsLoading(false);
    }
  }, [publicClient, deployment, decryptionKey]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  return useMemo(
    () => ({
      entries,
      isLoading,
      error,
      decryptionKey,
      auditorAddressOnChain,
      setDecryptionKey,
      refresh: fetchAll,
    }),
    [entries, isLoading, error, decryptionKey, auditorAddressOnChain, fetchAll],
  );
}
