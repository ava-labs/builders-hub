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

/**
 * Derives bridge phase state from existing stores + on-chain reads.
 *
 * The bridge has 6 phases (token → home → remote → register → collateral
 * → transfer). Phase status is derived from `useToolboxStore` keys +
 * cross-chain reads against the home contract for registration and
 * collateral state. No store schema changes — just a lightweight read
 * layer over what already exists.
 */
export function useBridgeState() {
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

  // Find the remote chain by scanning all toolbox stores in l1List.
  // Returns the first L1 (other than home) that has a TokenRemote
  // pointing at our home contract. v1 = 1:1, so first match wins.
  const remoteChain = useMemo<L1ListItem | undefined>(() => {
    if (!homeAddress || !homeChain) return undefined;
    for (const candidate of l1List) {
      if (candidate.id === homeChain.id) continue;
      const candidateStore = getToolboxStore(candidate.id).getState();
      if (candidateStore.erc20TokenRemoteAddress || candidateStore.nativeTokenRemoteAddress) {
        return candidate;
      }
    }
    return undefined;
  }, [homeAddress, homeChain, l1List]);

  // Look up the active remote on remoteChain's store. Falls back to the
  // home-chain's stored value when remoteChain is the same chain (which
  // shouldn't happen, but guards against bad state).
  const activeRemote = useMemo(() => {
    if (!remoteChain) {
      return { address: remoteAddress, kind: remoteKind };
    }
    const remoteStore = getToolboxStore(remoteChain.id).getState();
    if (remoteStore.nativeTokenRemoteAddress) {
      return { address: remoteStore.nativeTokenRemoteAddress, kind: 'native' as TokenKind };
    }
    if (remoteStore.erc20TokenRemoteAddress) {
      return { address: remoteStore.erc20TokenRemoteAddress, kind: 'erc20' as TokenKind };
    }
    return { address: null as string | null, kind: 'erc20' as TokenKind };
  }, [remoteChain, remoteAddress, remoteKind]);

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
