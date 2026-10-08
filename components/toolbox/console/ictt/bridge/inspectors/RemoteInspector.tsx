'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { ArrowRight, Coins, Fuel } from 'lucide-react';
import {
  useL1List,
  useL1ByChainId,
  useSetTeleporterRegistryAddress,
  type L1ListItem,
} from '@/components/toolbox/stores/l1ListStore';
import { getToolboxStore, NO_CHAIN_SELECTED } from '@/components/toolbox/stores/toolboxStore';
import { useWalletStore } from '@/components/toolbox/stores/walletStore';
import { useWallet } from '@/components/toolbox/hooks/useWallet';
import { Alert } from '@/components/toolbox/components/Alert';
import { Button } from '@/components/toolbox/components/Button';
import { HashChip } from '@/components/explorer-v2/ui';
import { ContractDeployViewer } from '@/components/console/contract-deploy-viewer';
import { ICTT_REMOTE_ERC20_SOURCES, ICTT_REMOTE_NATIVE_SOURCES } from '@/lib/ictt/contractSources';
import { useDeployTokenRemote } from '../hooks/useDeployTokenRemote';
import { useBridgeContext } from '../hooks/useBridgeContext';
import {
  BODY,
  ChainMark,
  Empty,
  FIELD,
  Field,
  Inspector,
  MONO_FIELD,
  Option,
  OptionGrid,
  Route,
  RouteEnd,
  StatusTag,
  TextAction,
} from '../ui';
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
  // Granular selectors so this inspector doesn't re-render on every wallet
  // store mutation — the destructure pattern (`const { x } = useWalletStore()`)
  // subscribes to the whole store and amplified mid-switch render churn.
  const walletEVMAddress = useWalletStore((s) => s.walletEVMAddress);
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
  // The store hook must run unconditionally (Rules of Hooks): select from
  // the sentinel store when no destination is chosen, discard the value.
  const destinationToolboxRegistryRaw = getToolboxStore(destinationL1Id || NO_CHAIN_SELECTED)(
    (s: { teleporterRegistryAddress: string }) => s.teleporterRegistryAddress,
  );
  const destinationToolboxRegistry = destinationL1Id ? destinationToolboxRegistryRaw : '';
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

  // No reset effect needed: the `autoSwitchedFor.current === destinationChainId`
  // guard in the effect above already short-circuits re-runs on the same
  // destination. When the user picks a different destination, the stored ref
  // no longer matches the new chain id, so the guard naturally fails and a
  // fresh switch is triggered. A previous version nulled the ref in a
  // sibling effect that ran AFTER the auto-switch in the same commit — that
  // wiped the guard out and let any subsequent re-render fire a second wallet
  // popup, jamming Core.

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
      <Inspector
        label="Phase 3 · TokenRemote"
        banner={
          !bridge?.homeAddress ? (
            <Alert variant="warning">Deploy TokenHome in Phase 2 before deploying a Remote.</Alert>
          ) : chainMismatch && destinationL1 ? (
            <Alert variant="warning">
              <div className="flex flex-col items-start gap-2">
                <span>
                  Deploying to {destinationL1.name} needs your wallet on that chain. Switch, or pick another L1 below.
                </span>
                <TextAction icon={ArrowRight} onClick={handleManualSwitch} disabled={isSwitching}>
                  {isSwitching ? 'Switching…' : `Switch to ${destinationL1.name}`}
                </TextAction>
              </div>
            </Alert>
          ) : null
        }
        footer={
          <Button
            onClick={chainMismatch ? handleManualSwitch : handleDeploy}
            disabled={(!chainMismatch && !canDeploy) || isSwitching || isDeploying}
            loading={isDeploying || isSwitching}
            loadingText={isSwitching ? 'Switching…' : 'Deploying…'}
            className="w-auto"
            icon={<ArrowRight className="h-3.5 w-3.5" aria-hidden />}
          >
            {(() => {
              if (chainMismatch) return `Switch to ${destinationL1?.name ?? 'destination'}`;
              const contractLabel = remoteKind === 'native-remote' ? 'NativeTokenRemote' : 'ERC20TokenRemote';
              if (!remote?.address) return `Deploy ${contractLabel}`;
              const switchingChain = destinationL1Id && remote.l1Id !== destinationL1Id;
              return switchingChain
                ? `Deploy on ${destinationL1?.name ?? 'new chain'} (replaces existing)`
                : `Re-deploy ${contractLabel}`;
            })()}
          </Button>
        }
      >
        <div className="flex flex-col gap-6">
          <p className={BODY}>
            {remoteKind === 'native-remote'
              ? `Deploy NativeTokenRemote on the destination so the bridged asset becomes its gas token. It is paired with ${homeL1?.name ?? 'Home'} and mints through the Native Minter precompile.`
              : `Deploy ERC20TokenRemote on the destination. It is paired with ${homeL1?.name ?? 'Home'}, and recipients get an ERC-20 copy of the bridged token.`}
          </p>

          <Route
            from={
              <RouteEnd
                side="From · Home"
                l1={homeL1 ?? null}
                name={homeL1?.name ?? 'Home chain'}
                detail={bridge?.symbol ?? undefined}
              />
            }
            to={
              <RouteEnd
                side="To · Remote"
                l1={destinationL1 ?? null}
                name={destinationL1?.name ?? 'Pick a destination'}
                detail={destinationL1 ? `Chain ID ${destinationL1.evmChainId}` : undefined}
              />
            }
          />

          <Field
            label="Destination chain"
            hint="Your wallet switches to this chain before deploying."
            error={sameChainError}
          >
            {candidates.length === 0 ? (
              <Empty eyebrow="No destinations">Add another L1 to the console to bridge to it.</Empty>
            ) : (
              <OptionGrid label="Destination chain" cols={3}>
                {candidates.map((l1: L1ListItem) => (
                  <Option
                    key={l1.id}
                    selected={destinationL1Id === l1.id}
                    onSelect={() => ctx.setPendingDestinationL1Id(l1.id)}
                    icon={<ChainMark l1={l1} size="sm" />}
                    title={l1.name}
                    description={<span className="font-mono text-[11px]">{l1.coinName}</span>}
                  />
                ))}
              </OptionGrid>
            )}
          </Field>

          {destinationL1 ? (
            <>
              <Field
                label="Remote token type"
                hint={
                  nativeMinterDisabled
                    ? `A native gas token needs the Native Minter precompile, which ${destinationL1.name}'s genesis does not enable.`
                    : nativeMinterUnknown
                      ? 'This chain’s genesis is not stored locally. Check that the Native Minter precompile is on before deploying the native type.'
                      : undefined
                }
              >
                <OptionGrid label="Remote token type">
                  <Option
                    selected={remoteKind === 'erc20-remote'}
                    onSelect={() => setRemoteKind('erc20-remote')}
                    icon={<KindIcon icon={Coins} />}
                    title="ERC-20 token"
                    description="Mints a wrapped ERC-20 on the destination."
                  />
                  <Option
                    selected={remoteKind === 'native-remote'}
                    onSelect={() => setRemoteKind('native-remote')}
                    disabled={nativeMinterDisabled}
                    disabledReason="Native Minter precompile is not enabled on this chain."
                    icon={<KindIcon icon={Fuel} />}
                    title="Native gas token"
                    description="Mints through the Native Minter so the asset becomes the L1’s gas token."
                  />
                </OptionGrid>
              </Field>

              {remoteKind === 'erc20-remote' ? (
                <div className="grid grid-cols-1 gap-5 md:grid-cols-[minmax(0,1fr)_12rem]">
                  <Field label="Mirrored token name" htmlFor="ictt-remote-name" hint="Shown on the Remote chain.">
                    <input
                      id="ictt-remote-name"
                      type="text"
                      value={tokenName}
                      onChange={(e) => setTokenName(e.target.value)}
                      placeholder={`${bridge?.symbol ?? 'Bridged'} on ${destinationL1.name}`}
                      className={FIELD}
                    />
                  </Field>

                  <Field label="Symbol" htmlFor="ictt-remote-symbol">
                    <input
                      id="ictt-remote-symbol"
                      type="text"
                      value={tokenSymbol}
                      onChange={(e) => setTokenSymbol(e.target.value.toUpperCase())}
                      placeholder={bridge?.symbol ?? 'TOKEN'}
                      className={MONO_FIELD}
                    />
                  </Field>
                </div>
              ) : (
                <>
                  <Field
                    label="Native asset symbol"
                    htmlFor="ictt-remote-native-symbol"
                    hint={`Shown wherever ${destinationL1.name}'s gas token appears (wallets, explorers).`}
                  >
                    <input
                      id="ictt-remote-native-symbol"
                      type="text"
                      value={tokenSymbol}
                      onChange={(e) => setTokenSymbol(e.target.value.toUpperCase())}
                      placeholder={destinationL1.coinName?.toUpperCase() ?? 'GAS'}
                      className={MONO_FIELD}
                    />
                  </Field>

                  <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                    <Field
                      label="Initial reserve imbalance"
                      htmlFor="ictt-remote-reserve"
                      hint="Native supply already on the destination (genesis allocations) not yet backed by locked Home tokens. Must be above zero."
                    >
                      <input
                        id="ictt-remote-reserve"
                        type="number"
                        min="1"
                        step="1"
                        value={initialReserveImbalance}
                        onChange={(e) => setInitialReserveImbalance(e.target.value)}
                        className={MONO_FIELD}
                      />
                    </Field>

                    <Field
                      label="Burned fees reward %"
                      htmlFor="ictt-remote-reward"
                      hint="0 to 100. Share of burned fees paid to whoever reports them. 0 turns rewards off."
                    >
                      <input
                        id="ictt-remote-reward"
                        type="number"
                        min="0"
                        max="100"
                        step="1"
                        value={burnedFeesReward}
                        onChange={(e) => setBurnedFeesReward(e.target.value)}
                        className={MONO_FIELD}
                      />
                    </Field>
                  </div>
                </>
              )}

              <Field label="Teleporter registry on destination" htmlFor="ictt-remote-registry" hint={registryHint}>
                <input
                  id="ictt-remote-registry"
                  type="text"
                  value={registry}
                  onChange={(e) => setRegistry(e.target.value.trim())}
                  placeholder={defaultRegistry || '0x…'}
                  className={MONO_FIELD}
                />
              </Field>

              <Field label="Teleporter manager" htmlFor="ictt-remote-manager" hint="Defaults to your wallet.">
                <input
                  id="ictt-remote-manager"
                  type="text"
                  value={manager}
                  onChange={(e) => setManager(e.target.value.trim())}
                  placeholder={walletEVMAddress || '0x…'}
                  className={MONO_FIELD}
                />
              </Field>
            </>
          ) : (
            candidates.length > 0 && <p className={BODY}>Pick a destination chain to set up the mirrored token.</p>
          )}

          {error && <Alert variant="error">{error.message}</Alert>}

          {remote?.address && destinationL1 && (
            <div className="flex flex-wrap items-center justify-between gap-3 border border-emerald-300 px-4 py-3 dark:border-emerald-900">
              <StatusTag tone="ok">TokenRemote on {destinationL1.name}</StatusTag>
              <HashChip value={remote.address} len={14} />
            </div>
          )}
        </div>
      </Inspector>
    </ContractDeployViewer>
  );
}

function KindIcon({ icon: Icon }: { icon: typeof Coins }) {
  return (
    <span className="flex h-8 w-8 shrink-0 items-center justify-center border border-zinc-200 text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
      <Icon className="h-3.5 w-3.5" aria-hidden />
    </span>
  );
}
