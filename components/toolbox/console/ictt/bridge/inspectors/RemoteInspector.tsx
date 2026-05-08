'use client';

import Link from 'next/link';
import { useState } from 'react';
import { ArrowRight, ExternalLink, Loader2 } from 'lucide-react';
import { useL1List, useL1ByChainId, type L1ListItem } from '@/components/toolbox/stores/l1ListStore';
import { useWalletStore } from '@/components/toolbox/stores/walletStore';
import { Note } from '@/components/toolbox/components/Note';
import { InspectorShell } from './InspectorShell';
import { useDeployTokenRemote } from '../hooks/useDeployTokenRemote';
import { truncateAddress } from '../utils/explorer-url';
import type { Address, Bridge, BridgePhase, BridgeStatus, Remote } from '../types';

interface RemoteInspectorProps {
  onPhaseChange: (next: BridgePhase) => void;
  status: BridgeStatus;
  bridge: Bridge | null;
  remote: Remote | null;
}

export function RemoteInspector({ onPhaseChange, status, bridge, remote }: RemoteInspectorProps) {
  const l1List = useL1List();
  const homeL1 = useL1ByChainId(bridge?.homeL1Id ?? '');
  const { walletEVMAddress } = useWalletStore();

  const [destinationL1Id, setDestinationL1Id] = useState<string>(remote?.l1Id ?? '');
  const destinationL1 = useL1ByChainId(destinationL1Id);
  const wellKnownRegistry = (destinationL1?.wellKnownTeleporterRegistryAddress ?? '') as Address;
  const [registry, setRegistry] = useState<string>('');
  const [manager, setManager] = useState<string>('');
  const [tokenName, setTokenName] = useState<string>('');
  const [tokenSymbol, setTokenSymbol] = useState<string>('');

  const { deployRemote, isDeploying, error } = useDeployTokenRemote(destinationL1Id);

  const sameChainError =
    destinationL1Id && bridge?.homeL1Id === destinationL1Id ? 'Source and destination must differ.' : null;

  const handleDeploy = async () => {
    if (!bridge?.id || !bridge.homeL1Id || !bridge.homeAddress || !bridge.decimals) return;
    if (!destinationL1) return;
    if (sameChainError) return;
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
    bridge?.id && bridge?.homeAddress && bridge.decimals && destinationL1Id && !sameChainError && !isDeploying,
  );

  return (
    <InspectorShell
      phase="remote"
      status={status}
      onPhaseChange={onPhaseChange}
      description={`Deploy ERC20TokenRemote on the destination L1. The constructor encodes the Home pair (${homeL1?.name ?? 'Home'} → destination).`}
      banner={
        !bridge?.homeAddress && (
          <Note variant="warning">
            <span className="text-xs">Deploy TokenHome in Phase 2 before deploying a Remote.</span>
          </Note>
        )
      }
      footer={
        <>
          <Link
            href="/console/ictt/legacy/setup/native-remote"
            className="inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800/60 dark:hover:text-zinc-100"
          >
            Native remote in legacy
            <ExternalLink className="h-3 w-3" aria-hidden />
          </Link>
          <button
            type="button"
            onClick={handleDeploy}
            disabled={!canDeploy}
            className="inline-flex items-center gap-1 rounded-md bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
          >
            {isDeploying && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />}
            {remote?.address ? 'Re-deploy TokenRemote' : 'Deploy TokenRemote'}
            {!isDeploying && <ArrowRight className="h-3.5 w-3.5" aria-hidden />}
          </button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <FormField label="Destination chain" hint="Switch your wallet to this chain before deploying.">
          <select
            value={destinationL1Id}
            onChange={(e) => setDestinationL1Id(e.target.value)}
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

        <FormField label="Mirrored token name" hint="Shown on the Remote chain.">
          <input
            type="text"
            value={tokenName}
            onChange={(e) => setTokenName(e.target.value)}
            placeholder={
              bridge?.symbol ? `${bridge.symbol} on ${destinationL1?.name ?? 'destination'}` : 'Bridged Token'
            }
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
