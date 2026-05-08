'use client';

import { useEffect, useMemo, useState } from 'react';
import { useToolboxStore, getToolboxStore } from '@/components/toolbox/stores/toolboxStore';
import { useSelectedL1, useL1List, useWrappedNativeToken } from '@/components/toolbox/stores/l1ListStore';
import type { L1ListItem } from '@/components/toolbox/stores/l1ListStore';
import { useWalletStore } from '@/components/toolbox/stores/walletStore';
import { makePublicClientForChain } from '@/components/toolbox/hooks/usePublicClientForChain';
import { cb58ToHex } from '@/components/tools/common/utils/cb58';
import ERC20TokenHomeABI from '@/contracts/icm-contracts/compiled/ERC20TokenHome.json';
import type { ContractSlot, PhaseId, PhaseStatus, TokenKind } from './types';

interface RegistrationStatus {
  registered: boolean;
  collateralNeeded: bigint;
  homeAddress: string | null;
  homeChainId: string | null;
  lastChecked: number | null;
}

const EMPTY_STATUS: RegistrationStatus = {
  registered: false,
  collateralNeeded: 0n,
  homeAddress: null,
  homeChainId: null,
  lastChecked: null,
};

interface UseBridgeStateArgs {
  /**
   * Optional override for which deployed remote to treat as the active
   * one. Used by the multi-remote picker in the remote panel header.
   * When unset, falls back to the first L1 with a deployed remote.
   */
  preferredRemoteChainId?: string;
}

interface RemoteCandidate {
  chain: L1ListItem;
  address: string;
  kind: TokenKind;
}

/**
 * Derives bridge phase state from existing stores + on-chain reads.
 *
 * The bridge has 6 phases (token → home → remote → register → collateral
 * → transfer). Phase status is derived from `useToolboxStore` keys +
 * cross-chain reads against the home contract for registration and
 * collateral state. No store schema changes — just a lightweight read
 * layer over what already exists.
 */
export function useBridgeState(args: UseBridgeStateArgs = {}) {
  const { preferredRemoteChainId } = args;
  const homeChain = useSelectedL1();
  const wrappedNative = useWrappedNativeToken();
  const l1List = useL1List();
  const walletEVMAddress = useWalletStore((s) => s.walletEVMAddress);
  const isTestnet = useWalletStore((s) => s.isTestnet);

  // Toolbox store reads for the home (selected) chain
  const {
    exampleErc20Address,
    erc20TokenHomeAddress,
    nativeTokenHomeAddress,
    erc20TokenRemoteAddress,
    nativeTokenRemoteAddress,
  } = useToolboxStore();

  // Active home contract — picks ERC20 over native if both exist.
  const homeKind: TokenKind = nativeTokenHomeAddress && !erc20TokenHomeAddress ? 'native' : 'erc20';
  const homeAddress = homeKind === 'erc20' ? erc20TokenHomeAddress : nativeTokenHomeAddress;

  // Active remote contract on the home chain's store (1:1 v1).
  const remoteKind: TokenKind = nativeTokenRemoteAddress && !erc20TokenRemoteAddress ? 'native' : 'erc20';
  const remoteAddress = remoteKind === 'erc20' ? erc20TokenRemoteAddress : nativeTokenRemoteAddress;

  // Token address — exampleErc20 if user deployed test token, else
  // wrappedNative if native flow, else null. Stays null until user picks.
  const tokenAddress: string | null = exampleErc20Address || wrappedNative || null;

  // All deployed remotes — every L1 (other than home) with a TokenRemote
  // address in its per-chain toolbox store. The picker UI uses this list;
  // the active remote is selected from here.
  const allRemotes = useMemo<RemoteCandidate[]>(() => {
    if (!homeChain) return [];
    const candidates: RemoteCandidate[] = [];
    for (const l1 of l1List) {
      if (l1.id === homeChain.id) continue;
      const store = getToolboxStore(l1.id).getState();
      if (store.nativeTokenRemoteAddress) {
        candidates.push({ chain: l1, address: store.nativeTokenRemoteAddress, kind: 'native' });
      } else if (store.erc20TokenRemoteAddress) {
        candidates.push({ chain: l1, address: store.erc20TokenRemoteAddress, kind: 'erc20' });
      }
    }
    return candidates;
  }, [homeChain, l1List]);

  // Pick the active remote: explicit preference if it matches a deployed
  // remote, otherwise the first deployed remote. Returns undefined when
  // no remote has been deployed yet.
  const activeRemoteEntry = useMemo<RemoteCandidate | undefined>(() => {
    if (allRemotes.length === 0) return undefined;
    if (preferredRemoteChainId) {
      const preferred = allRemotes.find((r) => r.chain.id === preferredRemoteChainId);
      if (preferred) return preferred;
    }
    return allRemotes[0];
  }, [allRemotes, preferredRemoteChainId]);

  const remoteChain = activeRemoteEntry?.chain;
  const activeRemote = activeRemoteEntry
    ? { address: activeRemoteEntry.address, kind: activeRemoteEntry.kind }
    : { address: remoteAddress, kind: remoteKind };

  // Poll the home contract for registration + collateral status whenever
  // we have a complete home/remote pair.
  const [status, setStatus] = useState<RegistrationStatus>(EMPTY_STATUS);
  const [pollTick, setPollTick] = useState(0);

  useEffect(() => {
    if (!homeChain || !homeAddress || !remoteChain || !activeRemote.address) {
      setStatus(EMPTY_STATUS);
      return;
    }

    let cancelled = false;
    const homeClient = makePublicClientForChain(homeChain.rpcUrl);
    if (!homeClient) return;

    const remoteBlockchainIDHex = (() => {
      try {
        return cb58ToHex(remoteChain.id);
      } catch {
        return null;
      }
    })();
    if (!remoteBlockchainIDHex) return;

    (async () => {
      try {
        const settings = (await homeClient.readContract({
          address: homeAddress as `0x${string}`,
          abi: ERC20TokenHomeABI.abi,
          functionName: 'getRemoteTokenTransferrerSettings',
          args: [remoteBlockchainIDHex, activeRemote.address as `0x${string}`],
        })) as {
          registered: boolean;
          collateralNeeded: bigint;
          tokenMultiplier: bigint;
          multiplyOnRemote: boolean;
        };
        if (cancelled) return;
        setStatus({
          registered: settings.registered,
          collateralNeeded: settings.collateralNeeded,
          homeAddress,
          homeChainId: homeChain.id,
          lastChecked: Date.now(),
        });
      } catch (err) {
        // Polling read failures are non-fatal — keep last known state.
        // Console logs would spam during chain-switch transitions.
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [homeChain?.id, homeAddress, remoteChain?.id, activeRemote.address, pollTick]);

  // Active phase polling — re-trigger every 5s while the bridge is
  // mid-setup (not yet collateralized) so the UI reflects ICM message
  // delivery without a manual refresh.
  useEffect(() => {
    if (!homeAddress || !activeRemote.address) return;
    const fullyCollateralized = status.registered && status.collateralNeeded === 0n;
    if (fullyCollateralized) return;
    const t = setInterval(() => setPollTick((n) => n + 1), 5000);
    return () => clearInterval(t);
  }, [homeAddress, activeRemote.address, status.registered, status.collateralNeeded]);

  // Phase-by-phase status derivation.
  const phaseStatus = useMemo<Record<PhaseId, PhaseStatus>>(() => {
    const tokenDone = !!tokenAddress;
    const homeDone = !!homeAddress;
    const remoteDone = !!activeRemote.address;
    const registerDone = status.registered;
    const collateralDone = status.registered && status.collateralNeeded === 0n;

    return {
      token: tokenDone ? 'done' : 'idle',
      home: homeDone ? 'done' : tokenDone ? 'idle' : 'blocked',
      remote: remoteDone ? 'done' : homeDone ? 'idle' : 'blocked',
      register: registerDone ? 'done' : remoteDone ? 'idle' : 'blocked',
      collateral: collateralDone ? 'done' : registerDone ? 'idle' : 'blocked',
      transfer: collateralDone ? 'idle' : 'blocked',
    };
  }, [tokenAddress, homeAddress, activeRemote.address, status.registered, status.collateralNeeded]);

  // Progress percentage (0-100) — share of completed setup phases. The
  // transfer phase is counted as part of "setup" only when at least one
  // send has happened, but for v1 we just count the 5 setup phases.
  const progress = useMemo(() => {
    const setupPhases: PhaseId[] = ['token', 'home', 'remote', 'register', 'collateral'];
    const done = setupPhases.filter((p) => phaseStatus[p] === 'done').length;
    return Math.round((done / setupPhases.length) * 100);
  }, [phaseStatus]);

  // Contract slot summaries for the chain panels.
  const homeContracts: ContractSlot[] = useMemo(
    () => [
      {
        label: 'Token',
        address: tokenAddress,
        status: tokenAddress ? 'deployed' : 'idle',
      },
      {
        label: 'TokenHome',
        address: homeAddress,
        status: homeAddress ? 'deployed' : 'idle',
      },
      {
        label: 'Collateral',
        address: null,
        status: status.registered && status.collateralNeeded === 0n ? 'deployed' : status.registered ? 'pending' : 'idle',
      },
    ],
    [tokenAddress, homeAddress, status.registered, status.collateralNeeded],
  );

  const remoteContracts: ContractSlot[] = useMemo(
    () => [
      {
        label: 'TokenRemote',
        address: activeRemote.address,
        status: activeRemote.address ? 'deployed' : 'idle',
      },
      {
        label: 'Registered with Home',
        address: null,
        status: status.registered ? 'deployed' : activeRemote.address ? 'pending' : 'idle',
      },
    ],
    [activeRemote.address, status.registered],
  );

  return {
    homeChain,
    remoteChain,
    /** Every L1 (other than home) with a deployed TokenRemote. Used by
     *  the remote panel's picker when more than one remote exists. */
    allRemotes,
    walletEVMAddress,
    isTestnet,
    homeKind,
    remoteKind: activeRemote.kind,
    tokenAddress,
    homeAddress,
    remoteAddress: activeRemote.address,
    registered: status.registered,
    collateralNeeded: status.collateralNeeded,
    lastChecked: status.lastChecked,
    phaseStatus,
    progress,
    homeContracts,
    remoteContracts,
    refresh: () => setPollTick((n) => n + 1),
  };
}

export type BridgeState = ReturnType<typeof useBridgeState>;
