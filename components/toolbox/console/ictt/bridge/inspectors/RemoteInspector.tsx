'use client';

import { useEffect, useRef, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { ArrowRight, Loader2 } from 'lucide-react';
import { useL1List, useL1ByChainId, type L1ListItem } from '@/components/toolbox/stores/l1ListStore';
import { useWalletStore } from '@/components/toolbox/stores/walletStore';
import { useWallet } from '@/components/toolbox/hooks/useWallet';
import { Note } from '@/components/toolbox/components/Note';
import { InspectorShell } from './InspectorShell';
import { useDeployTokenRemote } from '../hooks/useDeployTokenRemote';
import { useBridgeContext } from '../hooks/useBridgeContext';
import { truncateAddress } from '../utils/explorer-url';
import type { Address, Bridge, BridgePhase, Remote } from '../types';

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

  const [registry, setRegistry] = useState<string>('');
  const [manager, setManager] = useState<string>('');
  const [tokenName, setTokenName] = useState<string>('');
  const [tokenSymbol, setTokenSymbol] = useState<string>('');

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

  // When the chain changes, pre-fill the user-edit fields with sensible defaults
  // so the form looks finished — user can edit any field; otherwise the defaults
  // are what's sent on deploy. Fields reset to empty when destination is cleared.
  useEffect(() => {
    if (!destinationL1) {
      setRegistry('');
      setManager('');
      setTokenName('');
      setTokenSymbol('');
      return;
    }
    setRegistry(wellKnownRegistry);
    setManager(walletEVMAddress);
    setTokenName(`${bridge?.symbol ?? 'Bridged'} on ${destinationL1.name}`);
    setTokenSymbol(bridge?.symbol ?? 'TOKEN');
    // We intentionally re-fill on every destinationL1Id change. If the user has
    // typed custom values then changes the chain, the new chain's defaults
    // take over — that's the documented behavior.
  }, [destinationL1Id]);

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
    const useRegistry = (registry || wellKnownRegistry) as Address;
    const useManager = (manager || walletEVMAddress) as Address;
    if (!/^0x[a-fA-F0-9]{40}$/.test(useRegistry)) return;
    if (!/^0x[a-fA-F0-9]{40}$/.test(useManager)) return;
    const result = await deployRemote({
      bridgeId: bridge.id,
      homeL1Id: bridge.homeL1Id,
      homeAddress: bridge.homeAddress,
      homeDecimals: bridge.decimals,
      kind: 'erc20-remote',
      teleporterRegistryAddress: useRegistry,
      teleporterManager: useManager,
      minTeleporterVersion: 1,
      tokenName: tokenName || `${bridge.symbol ?? 'Bridged'} on ${destinationL1.name}`,
      tokenSymbol: tokenSymbol || (bridge.symbol ?? 'TOKEN'),
      decimals: bridge.decimals,
    });
    if (result) onPhaseChange('register');
  };

  const candidates = l1List.filter((l1: L1ListItem) => l1.id !== bridge?.homeL1Id);
  const canDeploy = Boolean(
    bridge?.id &&
    bridge?.homeAddress &&
    bridge.decimals &&
    destinationL1Id &&
    !sameChainError &&
    !isDeploying &&
    !chainMismatch &&
    !isSwitching,
  );

  return (
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
                Deploying to {destinationL1.name} requires your wallet to be on that chain. Pick a different L1 below or
                switch.
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
            if (chainMismatch) return isSwitching ? 'Switching…' : `Switch to ${destinationL1?.name ?? 'destination'}`;
            if (!remote?.address) return 'Deploy TokenRemote';
            const switchingChain = destinationL1Id && remote.l1Id !== destinationL1Id;
            return switchingChain
              ? `Deploy on ${destinationL1?.name ?? 'new chain'} (replaces existing)`
              : 'Re-deploy TokenRemote';
          })()}
          {!isDeploying && !isSwitching && <ArrowRight className="h-3.5 w-3.5" aria-hidden />}
        </button>
      }
    >
      <div className="flex flex-col gap-4">
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          Deploy ERC20TokenRemote on the destination L1. The constructor encodes the Home pair ({homeL1?.name ?? 'Home'}{' '}
          → destination).
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

            <FormField
              label="Teleporter registry on destination"
              hint="Defaults to the well-known address for the chosen chain."
            >
              <input
                type="text"
                value={registry}
                onChange={(e) => setRegistry(e.target.value.trim())}
                placeholder={wellKnownRegistry || '0x…'}
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
