'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useTokenHome } from '@/components/toolbox/hooks/contracts/bridge/useTokenHome';
import { useContractActions } from '@/components/toolbox/hooks/contracts';
import { makePublicClientForChain } from '@/components/toolbox/hooks/usePublicClientForChain';
import ExampleERC20 from '@/contracts/icm-contracts/compiled/ExampleERC20.json';
import ERC20TokenHomeAbi from '@/contracts/icm-contracts/compiled/ERC20TokenHome.json';
import { cb58ToHex } from '@/components/tools/common/utils/cb58';
import { useIcttBridgeStore } from '@/components/toolbox/stores/iccttBridgeStore';
import { useWalletStore } from '@/components/toolbox/stores/walletStore';
import { useL1ByChainId } from '@/components/toolbox/stores/l1ListStore';
import type { Address, Bridge, Remote } from '../types';

interface UseAddCollateralOptions {
  bridge: Bridge | null;
  remote: Remote | null;
}

type Stage = 'idle' | 'approving' | 'depositing' | 'done' | 'error';

export type CollateralPollState = 'idle' | 'polling' | 'delivered' | 'timeout' | 'rpc-error';

// Same shape as `useRegisterRemote`'s Home-side poll: short backoff on the first
// three attempts to catch fast-relayer cases, then a steady 4s tick up to the
// cap. Tuned so the user sees an "almost there" wait without spinning forever.
const INITIAL_BACKOFF_MS = [1_000, 3_000, 7_000];
const STEADY_INTERVAL_MS = 4_000;
const MAX_POLL_ATTEMPTS = 45;

export function useAddCollateral({ bridge, remote }: UseAddCollateralOptions) {
  const tokenHome = useTokenHome(bridge?.homeAddress ?? null, bridge?.kind === 'native-home' ? 'native' : 'erc20');
  const erc20 = useContractActions(bridge?.underlyingTokenAddress ?? null, ExampleERC20.abi);
  const homeL1 = useL1ByChainId(bridge?.homeL1Id ?? '');
  const upsertRemote = useIcttBridgeStore((s) => s.upsertRemote);
  const pushActivity = useIcttBridgeStore((s) => s.pushActivity);
  const updateActivity = useIcttBridgeStore((s) => s.updateActivity);
  const walletChainId = useWalletStore((s) => s.walletChainId);
  const walletEVMAddress = useWalletStore((s) => s.walletEVMAddress);
  const [stage, setStage] = useState<Stage>('idle');
  const [error, setError] = useState<Error | null>(null);
  const [allowance, setAllowance] = useState<bigint | null>(null);
  const [registered, setRegistered] = useState<boolean | null>(null);
  const [collateralNeeded, setCollateralNeeded] = useState<bigint | null>(null);
  const [refreshTick, setRefreshTick] = useState(0);
  const [pollState, setPollState] = useState<CollateralPollState>('idle');
  const [pollAttempts, setPollAttempts] = useState(0);
  const [lastError, setLastError] = useState<Error | null>(null);

  const pollAbortRef = useRef<{ cancelled: boolean } | null>(null);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      if (pollAbortRef.current) pollAbortRef.current.cancelled = true;
    };
  }, []);

  const refresh = useCallback(() => setRefreshTick((t) => t + 1), []);

  // Read the ERC-20 allowance against TokenHome from the Home L1's RPC so the
  // read doesn't depend on the wallet's current chain.
  useEffect(() => {
    if (!bridge?.underlyingTokenAddress || !bridge.homeAddress || !walletEVMAddress || !homeL1?.rpcUrl) return;
    let cancelled = false;
    const client = makePublicClientForChain(homeL1.rpcUrl);
    if (!client) return;
    client
      .readContract({
        address: bridge.underlyingTokenAddress,
        abi: ExampleERC20.abi,
        functionName: 'allowance',
        args: [walletEVMAddress, bridge.homeAddress],
      })
      .then((a) => {
        if (!cancelled) setAllowance(a as bigint);
      })
      .catch(() => {
        if (!cancelled) setAllowance(null);
      });
    return () => {
      cancelled = true;
    };
  }, [bridge?.underlyingTokenAddress, bridge?.homeAddress, walletEVMAddress, homeL1?.rpcUrl, refreshTick]);

  // Poll the Home contract for `getRemoteTokenTransferrerSettings(remote)` so
  // the UI tracks ICM delivery. Phase 4 marks the Remote registered locally
  // the moment its registerWithHome tx confirms, but the Home contract only
  // sees the registration after the ICM relayer delivers the message. Without
  // a poll the user lands on Phase 5 with `registered = false` forever and no
  // signal that the wait is normal.
  //
  // Backoff: 1s → 3s → 7s (catches fast relayers), then a steady 4s tick up to
  // ~3 min total. Stops polling on delivered/timeout/error. Reset triggers via
  // `refreshTick` so the Refresh button restarts cleanly.
  useEffect(() => {
    if (!bridge?.homeAddress || !remote || bridge.kind !== 'erc20-home' || !homeL1?.rpcUrl) {
      setPollState('idle');
      setPollAttempts(0);
      return;
    }
    const client = makePublicClientForChain(homeL1.rpcUrl);
    if (!client) {
      setPollState('rpc-error');
      setLastError(new Error('Could not initialise Home RPC client.'));
      return;
    }

    // Cancel any prior poll loop so we never have two alive at once.
    if (pollAbortRef.current) pollAbortRef.current.cancelled = true;
    const token = { cancelled: false };
    pollAbortRef.current = token;

    setPollState('polling');
    setPollAttempts(0);
    setLastError(null);

    const blockchainIDHex = cb58ToHex(remote.l1Id) as Address;
    let attempt = 0;
    let timeoutHandle: ReturnType<typeof setTimeout> | null = null;
    let sawError = false;

    const scheduleNext = () => {
      if (token.cancelled || !isMountedRef.current) return;
      const delay = attempt < INITIAL_BACKOFF_MS.length ? INITIAL_BACKOFF_MS[attempt] : STEADY_INTERVAL_MS;
      timeoutHandle = setTimeout(tick, delay);
    };

    const tick = async () => {
      if (token.cancelled || !isMountedRef.current) return;
      attempt += 1;
      setPollAttempts(attempt);
      try {
        const settings = (await client.readContract({
          address: bridge.homeAddress,
          abi: ERC20TokenHomeAbi.abi,
          functionName: 'getRemoteTokenTransferrerSettings',
          args: [blockchainIDHex, remote.address],
        })) as { registered: boolean; collateralNeeded?: bigint };
        if (token.cancelled || !isMountedRef.current) return;
        const isRegistered = Boolean(settings?.registered);
        const needed = typeof settings?.collateralNeeded === 'bigint' ? settings.collateralNeeded : null;
        setRegistered(isRegistered);
        setCollateralNeeded(needed);
        setLastError(null);
        sawError = false;
        if (isRegistered) {
          setPollState('delivered');
          return;
        }
      } catch (err) {
        if (token.cancelled || !isMountedRef.current) return;
        sawError = true;
        setLastError(err instanceof Error ? err : new Error(String(err)));
        // Don't clear `registered`/`collateralNeeded` on transient RPC errors —
        // a previous good read may still be valid. The poll keeps trying.
      }
      if (attempt >= MAX_POLL_ATTEMPTS) {
        if (token.cancelled || !isMountedRef.current) return;
        setPollState(sawError ? 'rpc-error' : 'timeout');
        return;
      }
      scheduleNext();
    };

    // First read immediately so a delivered relay doesn't wait 1s.
    void tick();

    return () => {
      token.cancelled = true;
      if (timeoutHandle) clearTimeout(timeoutHandle);
    };
    // `lastError` intentionally omitted from deps — it's a read-side derived
    // signal and including it would loop the effect on every transient failure.
  }, [bridge?.homeAddress, bridge?.kind, remote, homeL1?.rpcUrl, refreshTick]);

  // Auto-mark the remote as collateralized when the contract reports no collateral
  // is needed (matching decimals + no initialReserveImbalance). Without this, the
  // user lands on Phase 5 and Phase 6 with no actionable UI — the contract reverts
  // any manual addCollateral with "zero collateral needed".
  useEffect(() => {
    if (!bridge || !remote) return;
    if (bridge.kind !== 'erc20-home') return;
    if (collateralNeeded !== 0n) return;
    if (registered !== true) return;
    if (remote.collateralizedAt) return;
    upsertRemote(bridge.id, { ...remote, collateralizedAt: Date.now() });
  }, [bridge, remote, collateralNeeded, registered, upsertRemote]);

  const approve = async (amount: bigint): Promise<Address | null> => {
    if (!bridge || bridge.kind !== 'erc20-home') return null;
    setError(null);
    setStage('approving');
    const activityId = pushActivity({
      bridgeId: bridge.id,
      remoteId: remote?.id,
      kind: 'collateral',
      label: 'Approve TokenHome to spend collateral',
      sublabel: 'Step 1 of 2',
      chainId: walletChainId,
      status: 'pending',
    });
    try {
      const txHash = (await erc20.write(
        'approve',
        [bridge.homeAddress, amount],
        'Approve TokenHome to spend collateral',
      )) as Address;
      // Wait for confirmation so the subsequent allowance refresh sees the
      // new value (write returns once the tx is broadcast, not mined).
      if (homeL1?.rpcUrl) {
        try {
          const client = makePublicClientForChain(homeL1.rpcUrl);
          if (client) await client.waitForTransactionReceipt({ hash: txHash, timeout: 60_000 });
        } catch {
          // Best-effort: if the receipt wait fails the user can hit Refresh.
        }
      }
      updateActivity(activityId, { status: 'confirmed', txHash, sublabel: 'Approval confirmed' });
      setStage('idle');
      refresh();
      return txHash;
    } catch (err) {
      const e = err instanceof Error ? err : new Error(String(err));
      setError(e);
      updateActivity(activityId, { status: 'failed', sublabel: e.message });
      setStage('error');
      return null;
    }
  };

  const addCollateral = async (amount: bigint): Promise<Address | null> => {
    if (!bridge || !remote) return null;
    setError(null);
    setStage('depositing');
    const activityId = pushActivity({
      bridgeId: bridge.id,
      remoteId: remote.id,
      kind: 'collateral',
      label: 'Add collateral',
      sublabel: bridge.kind === 'native-home' ? 'Sending native to Home' : 'Step 2 of 2',
      chainId: walletChainId,
      status: 'pending',
    });
    try {
      const blockchainIDHex = cb58ToHex(remote.l1Id) as Address;
      const depositTx = (await tokenHome.addCollateral(blockchainIDHex, remote.address, amount)) as Address;
      updateActivity(activityId, { status: 'confirmed', txHash: depositTx, sublabel: 'Collateral added' });
      upsertRemote(bridge.id, { ...remote, collateralizedAt: Date.now() });
      setStage('done');
      refresh();
      return depositTx;
    } catch (err) {
      const e = err instanceof Error ? err : new Error(String(err));
      setError(e);
      updateActivity(activityId, { status: 'failed', sublabel: e.message });
      setStage('error');
      return null;
    }
  };

  return {
    approve,
    addCollateral,
    stage,
    isBusy: stage === 'approving' || stage === 'depositing',
    error,
    allowance,
    registered,
    collateralNeeded,
    refresh,
    pollState,
    pollAttempts,
    pollMaxAttempts: MAX_POLL_ATTEMPTS,
    lastError,
  };
}
