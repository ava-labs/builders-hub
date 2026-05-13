'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { ArrowRight, Loader2 } from 'lucide-react';
import {
  useL1List,
  useL1ByChainId,
  useSetTeleporterRegistryAddress,
  type L1ListItem,
} from '@/components/toolbox/stores/l1ListStore';
import { getToolboxStore } from '@/components/toolbox/stores/toolboxStore';
import { useWalletStore } from '@/components/toolbox/stores/walletStore';
import { useWallet } from '@/components/toolbox/hooks/useWallet';
import { Note } from '@/components/toolbox/components/Note';
import { ContractDeployViewer } from '@/components/console/contract-deploy-viewer';
import { ICTT_REMOTE_ERC20_SOURCES, ICTT_REMOTE_NATIVE_SOURCES } from '@/lib/ictt/contractSources';
import { cn } from '@/lib/utils';
import { InspectorShell } from '@/components/console/inspector-shell';
import { useDeployTokenRemote } from '../hooks/useDeployTokenRemote';
import { useBridgeContext } from '../hooks/useBridgeContext';
import { truncateAddress } from '../utils/explorer-url';
import { detectNativeMinterPrecompile } from '../utils/native-minter';
import type { Address, Bridge, BridgePhase, Remote, RemoteKind } from '../types';

interface RemoteInspectorProps {
  onPhaseChange: (next: BridgePhase) => void;
  bridge: Bridge | null;
  remote: Remote | null;
}

export function RemoteInspector({ onPhaseChange, bridge, remote }: RemoteInspectorProps) {
  const ctx = useBridgeContext({ step: 'remote' });
  const l1List = useL1List();
  const homeL1 = useL1ByChainId(bridge?.homeL1Id ?? '');
  const { walletEVMAddress } = useWalletStore();
  const walletChainId = useWalletStore((s) => s.walletChainId);
  const { switchChainOrAdd } = useWallet();
  const [isSwitching, setIsSwitching] = useState(false);
  const autoSwitchedFor = useRef<number | null>(null);

  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const requestedDestination = searchParams.get('destination');

  // Single source of truth: the store. User picks win over the deployed remote's
  // chain so re-deploying to a different L1 actually works. The deployed remote's
  // L1 is used only to seed the store when nothing else is set.
  const destinationL1Id = ctx.pendingDestinationL1Id ?? requestedDestination ?? remote?.l1Id ?? '';
  const destinationL1 = useL1ByChainId(destinationL1Id);
  const wellKnownRegistry = (destinationL1?.wellKnownTeleporterRegistryAddress ?? '') as Address;

  // Read the destination L1's toolbox store as a fallback. The toolboxStore
  // is keyed by L1 id, so we look up the destination explicitly (NOT the
  // wallet's current selectedL1 — Remote phase is about the destination).
  // Heals user-created destination L1s where ICM was deployed but the
  // address never propagated to l1ListStore. The fallback chain matches
  // HomeInspector: toolbox > well-known > empty.
  const destinationToolboxRegistry = destinationL1Id
    ? getToolboxStore(destinationL1Id)((s: { teleporterRegistryAddress: string }) => s.teleporterRegistryAddress)
    : '';
  const defaultRegistry = (destinationToolboxRegistry || wellKnownRegistry || '') as Address;
  const setTeleporterRegistryOnDestinationL1 = useSetTeleporterRegistryAddress();

  const registryHint = destinationToolboxRegistry
    ? 'Defaults to the ICM Registry you deployed on this chain.'
    : wellKnownRegistry
      ? 'Defaults to the well-known address for this chain.'
      : 'Run ICM setup on the destination L1 to get a default — or paste a known Registry address.';

  const [registry, setRegistry] = useState<string>('');
  const [manager, setManager] = useState<string>('');
  const [tokenName, setTokenName] = useState<string>('');
  const [tokenSymbol, setTokenSymbol] = useState<string>('');
  // Kind selector lets the user pick between ERC-20 (default) and native gas
  // token remotes. The hook accepts both, but the v2 wizard only exposed the
  // ERC-20 path until this commit. Native remote requires the Native Minter
  // precompile on the destination L1 — see `nativeMinterStatus` below.
  const [remoteKind, setRemoteKind] = useState<RemoteKind>('erc20-remote');
  const [initialReserveImbalance, setInitialReserveImbalance] = useState<string>('1');
  const [burnedFeesReward, setBurnedFeesReward] = useState<string>('0');

  // Offline precompile detection so the radio is disabled-with-a-tooltip on
  // chains without `contractNativeMinterConfig`. Returns `'unknown'` for
  // imported/older L1s where genesis was never stored — those still allow the
  // user to try (the deploy tx itself will revert if precompile is missing).
  const nativeMinterStatus = useMemo(
    () => detectNativeMinterPrecompile(destinationL1?.genesisData),
    [destinationL1?.genesisData],
  );
  const nativeMinterUnknown = nativeMinterStatus === 'unknown';
  const nativeMinterDisabled = nativeMinterStatus === false;
  // Auto-revert to ERC-20 if the user picked native then switched to a chain
  // without the precompile.
  useEffect(() => {
    if (remoteKind === 'native-remote' && nativeMinterDisabled) {
      setRemoteKind('erc20-remote');
    }
  }, [remoteKind, nativeMinterDisabled]);

  // One-time seed: when the store has no destination yet, seed from the URL
  // param or the already-deployed remote's L1. After this the store is canonical
  // and the user can switch to any L1 via the dropdown.
  useEffect(() => {
    if (ctx.pendingDestinationL1Id) return;
    const seed = requestedDestination ?? remote?.l1Id ?? null;
    if (seed) ctx.setPendingDestinationL1Id(seed);
  }, [ctx, requestedDestination, remote?.l1Id]);

  // Mirror store → URL so reloads/bookmarks reflect the current choice.
  useEffect(() => {
    if (!ctx.pendingDestinationL1Id) return;
    if (ctx.pendingDestinationL1Id === requestedDestination) return;
    const params = new URLSearchParams(searchParams.toString());
    params.set('destination', ctx.pendingDestinationL1Id);
    router.replace(`${pathname}?${params.toString()}`);
  }, [ctx.pendingDestinationL1Id, requestedDestination, router, pathname, searchParams]);

  // When the chain or kind changes, pre-fill the user-edit fields with sensible
  // defaults so the form looks finished — user can edit any field; otherwise
  // the defaults are what's sent on deploy. Fields reset to empty when
  // destination is cleared.
  useEffect(() => {
    if (!destinationL1) {
      setRegistry('');
      setManager('');
      setTokenName('');
      setTokenSymbol('');
      return;
    }
    setRegistry(defaultRegistry);
    setManager(walletEVMAddress);
    if (remoteKind === 'erc20-remote') {
      setTokenName(`${bridge?.symbol ?? 'Bridged'} on ${destinationL1.name}`);
      setTokenSymbol(bridge?.symbol ?? 'TOKEN');
    } else {
      // NativeTokenRemote stores only the asset symbol — there is no separate
      // on-chain name. Default to the L1's existing coin name so the bridge
      // visibly mints "the L1's gas token" rather than the bridge's home
      // symbol (which would shadow the user's chosen native symbol).
      setTokenName('');
      setTokenSymbol(destinationL1.coinName?.toUpperCase() ?? bridge?.symbol ?? 'TOKEN');
    }
    // We intentionally re-fill on every destinationL1Id / remoteKind change.
    // If the user has typed custom values then changes the chain or kind, the
    // new defaults take over — that's the documented behavior.
  }, [destinationL1Id, defaultRegistry, remoteKind]);

  // One-time backfill: if the destination's toolbox store has a registry but
  // the L1ListItem doesn't yet, propagate so the dashboard ICM signal and
  // future bridge sessions on this destination see it. Only fires when the
  // wallet is on the destination chain (the setter matches by walletChainId,
  // which is the only safe case — writing while on a different chain would
  // miss the right entry).
  useEffect(() => {
    if (!destinationToolboxRegistry || wellKnownRegistry) return;
    if (!destinationL1 || destinationL1.evmChainId !== walletChainId) return;
    setTeleporterRegistryOnDestinationL1(destinationToolboxRegistry);
  }, [
    destinationToolboxRegistry,
    wellKnownRegistry,
    destinationL1,
    walletChainId,
    setTeleporterRegistryOnDestinationL1,
  ]);

  const { deployRemote, isDeploying, error } = useDeployTokenRemote(destinationL1Id);

  const sameChainError =
    destinationL1Id && bridge?.homeL1Id === destinationL1Id ? 'Source and destination must differ.' : null;

  // Wallet is on the wrong chain for deploying to the picked destination.
  // We only gate the deploy action — the dropdown stays interactive so the
  // user can change their mind without first switching chains.
  const destinationChainId = destinationL1?.evmChainId ?? null;
  const chainMismatch =
    destinationChainId != null && walletChainId != null && walletChainId !== 0 && walletChainId !== destinationChainId;

  // Auto-switch once per destination change. If the user manually switches back,
  // we don't fight them — the deploy button just shows the Switch CTA again.
  // Uses `switchChainOrAdd` so picking an L1 the wallet doesn't have yet (e.g.
  // a freshly-created user L1) prompts add+switch in a single wallet popup
  // rather than silently failing.
  useEffect(() => {
    if (!destinationChainId || !walletEVMAddress || !destinationL1) return;
    if (!chainMismatch) return;
    if (autoSwitchedFor.current === destinationChainId) return;
    autoSwitchedFor.current = destinationChainId;
    void switchChainOrAdd(destinationL1).catch(() => {});
  }, [destinationChainId, chainMismatch, walletEVMAddress, switchChainOrAdd, destinationL1]);

  // Reset auto-switch marker when the destination changes so a new pick triggers
  // a fresh switch attempt.
  useEffect(() => {
    autoSwitchedFor.current = null;
  }, [destinationChainId]);

  const handleManualSwitch = async () => {
    if (!destinationL1) return;
    setIsSwitching(true);
    try {
      await switchChainOrAdd(destinationL1);
    } finally {
      setIsSwitching(false);
    }
  };

  const handleDeploy = async () => {
    if (!bridge?.id || !bridge.homeL1Id || !bridge.homeAddress || !bridge.decimals) return;
    if (!destinationL1) return;
    if (sameChainError) return;
    if (chainMismatch) {
      await handleManualSwitch();
      return;
    }
    const useRegistry = (registry || defaultRegistry) as Address;
    const useManager = (manager || walletEVMAddress) as Address;
    if (!/^0x[a-fA-F0-9]{40}$/.test(useRegistry)) return;
    if (!/^0x[a-fA-F0-9]{40}$/.test(useManager)) return;
    if (remoteKind === 'native-remote') {
      // NativeTokenRemote's constructor reverts on `initialReserveImbalance == 0`
      // and on `burnedFeesReportingRewardPercentage > 100`. Surface the
      // validation here rather than letting the wallet pop and revert.
      const reserve = (() => {
        try {
          return BigInt(initialReserveImbalance || '0');
        } catch {
          return 0n;
        }
      })();
      if (reserve <= 0n) return;
      const reward = Number.parseInt(burnedFeesReward || '0', 10);
      if (!Number.isFinite(reward) || reward < 0 || reward > 100) return;
    }
    const erc20DefaultName = `${bridge.symbol ?? 'Bridged'} on ${destinationL1.name}`;
    const nativeDefaultSymbol = destinationL1.coinName?.toUpperCase() ?? bridge.symbol ?? 'TOKEN';
    const result = await deployRemote({
      bridgeId: bridge.id,
      homeL1Id: bridge.homeL1Id,
      homeAddress: bridge.homeAddress,
      homeDecimals: bridge.decimals,
      kind: remoteKind,
      teleporterRegistryAddress: useRegistry,
      teleporterManager: useManager,
      minTeleporterVersion: 1,
      tokenName: remoteKind === 'erc20-remote' ? tokenName || erc20DefaultName : '',
      tokenSymbol:
        remoteKind === 'erc20-remote' ? tokenSymbol || (bridge.symbol ?? 'TOKEN') : tokenSymbol || nativeDefaultSymbol,
      decimals: bridge.decimals,
      initialReserveImbalance: remoteKind === 'native-remote' ? BigInt(initialReserveImbalance || '1') : undefined,
      burnedFeesReportingRewardPercentage:
        remoteKind === 'native-remote' ? Number.parseInt(burnedFeesReward || '0', 10) : undefined,
    });
    if (result) onPhaseChange('register');
  };

  const candidates = l1List.filter((l1: L1ListItem) => l1.id !== bridge?.homeL1Id);
  const nativeRemoteFieldsValid =
    remoteKind !== 'native-remote' ||
    (() => {
      try {
        if (BigInt(initialReserveImbalance || '0') <= 0n) return false;
      } catch {
        return false;
      }
      const reward = Number.parseInt(burnedFeesReward || '0', 10);
      return Number.isFinite(reward) && reward >= 0 && reward <= 100;
    })();
  const canDeploy = Boolean(
    bridge?.id &&
    bridge?.homeAddress &&
    bridge.decimals &&
    destinationL1Id &&
    !sameChainError &&
    !isDeploying &&
    !chainMismatch &&
    !isSwitching &&
    nativeRemoteFieldsValid,
  );

  return (
    <ContractDeployViewer
      contracts={remoteKind === 'native-remote' ? ICTT_REMOTE_NATIVE_SOURCES : ICTT_REMOTE_ERC20_SOURCES}
    >
      <InspectorShell
        banner={
          !bridge?.homeAddress ? (
            <Note variant="warning">
              <span className="text-xs">Deploy TokenHome in Phase 2 before deploying a Remote.</span>
            </Note>
          ) : chainMismatch && destinationL1 ? (
            <Note variant="warning">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <span className="text-xs">
                  Deploying to {destinationL1.name} requires your wallet to be on that chain. Pick a different L1 below
                  or switch.
                </span>
                <button
                  type="button"
                  onClick={handleManualSwitch}
                  disabled={isSwitching}
                  className="inline-flex items-center gap-1 rounded-md bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
                >
                  {isSwitching ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                  ) : (
                    <ArrowRight className="h-3.5 w-3.5" aria-hidden />
                  )}
                  {isSwitching ? 'Switching…' : `Switch to ${destinationL1.name}`}
                </button>
              </div>
            </Note>
          ) : null
        }
        footer={
          <button
            type="button"
            onClick={chainMismatch ? handleManualSwitch : handleDeploy}
            disabled={(!chainMismatch && !canDeploy) || isSwitching || isDeploying}
            className="inline-flex items-center gap-1 rounded-md bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
          >
            {(isDeploying || isSwitching) && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />}
            {(() => {
              if (chainMismatch)
                return isSwitching ? 'Switching…' : `Switch to ${destinationL1?.name ?? 'destination'}`;
              const contractLabel = remoteKind === 'native-remote' ? 'NativeTokenRemote' : 'ERC20TokenRemote';
              if (!remote?.address) return `Deploy ${contractLabel}`;
              const switchingChain = destinationL1Id && remote.l1Id !== destinationL1Id;
              return switchingChain
                ? `Deploy on ${destinationL1?.name ?? 'new chain'} (replaces existing)`
                : `Re-deploy ${contractLabel}`;
            })()}
            {!isDeploying && !isSwitching && <ArrowRight className="h-3.5 w-3.5" aria-hidden />}
          </button>
        }
      >
        <div className="flex flex-col gap-4">
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            {remoteKind === 'native-remote'
              ? `Deploy NativeTokenRemote on the destination L1 so the bridged asset becomes its native gas. The constructor encodes the Home pair (${homeL1?.name ?? 'Home'} → destination) and mints via the Native Minter precompile.`
              : `Deploy ERC20TokenRemote on the destination L1. The constructor encodes the Home pair (${homeL1?.name ?? 'Home'} → destination) so users receive an ERC-20 representation of the bridged token.`}
          </p>

          <FormField label="Destination chain" hint="Switch your wallet to this chain before deploying.">
            <select
              value={destinationL1Id}
              onChange={(e) => ctx.setPendingDestinationL1Id(e.target.value || null)}
              className="w-full rounded-md border border-zinc-200 bg-white px-3 py-1.5 text-sm text-zinc-900 outline-none focus:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
            >
              <option value="">— Select a destination —</option>
              {candidates.map((l1: L1ListItem) => (
                <option key={l1.id} value={l1.id}>
                  {l1.name}
                </option>
              ))}
            </select>
            {sameChainError && <p className="mt-1 text-[11px] text-red-600 dark:text-red-400">{sameChainError}</p>}
          </FormField>

          {destinationL1 ? (
            <>
              <FormField
                label="Remote token type"
                hint={
                  nativeMinterDisabled
                    ? `Native gas token requires the Native Minter precompile, which is not enabled in ${destinationL1.name}'s genesis.`
                    : nativeMinterUnknown
                      ? 'Genesis for this chain is not stored locally — verify the Native Minter precompile is enabled before deploying the native variant.'
                      : 'ERC-20 mints a wrapped token on the destination. Native uses the Minter precompile so the bridged asset becomes the L1’s gas token.'
                }
              >
                <div className="flex gap-2" role="radiogroup" aria-label="Remote token type">
                  <RemoteKindButton
                    label="ERC-20 token"
                    selected={remoteKind === 'erc20-remote'}
                    onClick={() => setRemoteKind('erc20-remote')}
                  />
                  <RemoteKindButton
                    label="Native gas token"
                    selected={remoteKind === 'native-remote'}
                    disabled={nativeMinterDisabled}
                    onClick={() => setRemoteKind('native-remote')}
                  />
                </div>
              </FormField>

              {remoteKind === 'erc20-remote' ? (
                <>
                  <FormField label="Mirrored token name" hint="Shown on the Remote chain.">
                    <input
                      type="text"
                      value={tokenName}
                      onChange={(e) => setTokenName(e.target.value)}
                      placeholder={`${bridge?.symbol ?? 'Bridged'} on ${destinationL1.name}`}
                      className="w-full rounded-md border border-zinc-200 bg-white px-3 py-1.5 text-sm text-zinc-900 outline-none focus:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
                    />
                  </FormField>

                  <FormField label="Mirrored token symbol">
                    <input
                      type="text"
                      value={tokenSymbol}
                      onChange={(e) => setTokenSymbol(e.target.value.toUpperCase())}
                      placeholder={bridge?.symbol ?? 'TOKEN'}
                      className="w-full rounded-md border border-zinc-200 bg-white px-3 py-1.5 text-sm text-zinc-900 outline-none focus:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
                    />
                  </FormField>
                </>
              ) : (
                <>
                  <FormField
                    label="Native asset symbol"
                    hint={`Shown wherever ${destinationL1.name}'s gas token is displayed (wallets, explorers).`}
                  >
                    <input
                      type="text"
                      value={tokenSymbol}
                      onChange={(e) => setTokenSymbol(e.target.value.toUpperCase())}
                      placeholder={destinationL1.coinName?.toUpperCase() ?? 'GAS'}
                      className="w-full rounded-md border border-zinc-200 bg-white px-3 py-1.5 text-sm text-zinc-900 outline-none focus:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
                    />
                  </FormField>

                  <FormField
                    label="Initial reserve imbalance"
                    hint="Native supply already on the destination L1 (e.g. from genesis allocations) that is not yet backed by locked home tokens. Must be greater than zero."
                  >
                    <input
                      type="number"
                      min="1"
                      step="1"
                      value={initialReserveImbalance}
                      onChange={(e) => setInitialReserveImbalance(e.target.value)}
                      className="w-full rounded-md border border-zinc-200 bg-white px-3 py-1.5 text-sm text-zinc-900 outline-none focus:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
                    />
                  </FormField>

                  <FormField
                    label="Burned fees reward %"
                    hint="0–100. Percentage of burned transaction fees rewarded to whoever reports them via the precompile. Leave at 0 to disable rewards."
                  >
                    <input
                      type="number"
                      min="0"
                      max="100"
                      step="1"
                      value={burnedFeesReward}
                      onChange={(e) => setBurnedFeesReward(e.target.value)}
                      className="w-full rounded-md border border-zinc-200 bg-white px-3 py-1.5 text-sm text-zinc-900 outline-none focus:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
                    />
                  </FormField>
                </>
              )}

              <FormField label="Teleporter registry on destination" hint={registryHint}>
                <input
                  type="text"
                  value={registry}
                  onChange={(e) => setRegistry(e.target.value.trim())}
                  placeholder={defaultRegistry || '0x…'}
                  className="w-full rounded-md border border-zinc-200 bg-white px-3 py-1.5 font-mono text-xs text-zinc-900 outline-none focus:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
                />
              </FormField>

              <FormField label="Teleporter manager" hint="Defaults to your wallet.">
                <input
                  type="text"
                  value={manager}
                  onChange={(e) => setManager(e.target.value.trim())}
                  placeholder={walletEVMAddress || '0x…'}
                  className="w-full rounded-md border border-zinc-200 bg-white px-3 py-1.5 font-mono text-xs text-zinc-900 outline-none focus:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
                />
              </FormField>
            </>
          ) : (
            <p className="text-xs italic text-zinc-500 dark:text-zinc-400">
              Pick a destination chain first to configure the mirrored token.
            </p>
          )}

          {error && (
            <Note variant="destructive">
              <span className="text-xs">{error.message}</span>
            </Note>
          )}

          {remote?.address && destinationL1 && (
            <div className="flex items-center justify-between gap-2 rounded-lg bg-emerald-50/60 px-3 py-2 text-xs dark:bg-emerald-950/20">
              <span className="font-medium text-emerald-800 dark:text-emerald-300">
                TokenRemote on {destinationL1.name}
              </span>
              <code className="font-mono text-[11px] text-emerald-800 dark:text-emerald-300">
                {truncateAddress(remote.address, 10, 6)}
              </code>
            </div>
          )}
        </div>
      </InspectorShell>
    </ContractDeployViewer>
  );
}

interface FormFieldProps {
  label: string;
  hint?: string;
  children: React.ReactNode;
}

function FormField({ label, hint, children }: FormFieldProps) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-medium text-zinc-700 dark:text-zinc-200">{label}</label>
      {children}
      {hint && <span className="text-[10px] text-zinc-500 dark:text-zinc-400">{hint}</span>}
    </div>
  );
}

interface RemoteKindButtonProps {
  label: string;
  selected: boolean;
  disabled?: boolean;
  onClick: () => void;
}

function RemoteKindButton({ label, selected, disabled, onClick }: RemoteKindButtonProps) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'flex-1 rounded-md border px-3 py-1.5 text-xs font-medium transition-colors',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400/60',
        selected
          ? 'border-zinc-900 bg-zinc-900 text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900'
          : 'border-zinc-200 bg-white text-zinc-700 hover:border-zinc-300 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:border-zinc-600 dark:hover:bg-zinc-800',
        disabled &&
          'cursor-not-allowed opacity-50 hover:border-zinc-200 hover:bg-white dark:hover:border-zinc-700 dark:hover:bg-zinc-900',
      )}
    >
      {label}
    </button>
  );
}
