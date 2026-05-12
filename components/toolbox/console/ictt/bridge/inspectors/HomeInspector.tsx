'use client';

import { useEffect, useState } from 'react';
import { ArrowRight, Loader2 } from 'lucide-react';
import { useSelectedL1 } from '@/components/toolbox/stores/l1ListStore';
import { useWalletStore } from '@/components/toolbox/stores/walletStore';
import { useViemChainStore } from '@/components/toolbox/stores/toolboxStore';
import { makePublicClientForChain } from '@/components/toolbox/hooks/usePublicClientForChain';
import ExampleERC20 from '@/contracts/icm-contracts/compiled/ExampleERC20.json';
import { Note } from '@/components/toolbox/components/Note';
import { InspectorShell } from './InspectorShell';
import { useDeployTokenHome } from '../hooks/useDeployTokenHome';
import { truncateAddress } from '../utils/explorer-url';
import type { Address, BridgePhase, Bridge } from '../types';

interface HomeInspectorProps {
  onPhaseChange: (next: BridgePhase) => void;
  underlyingTokenAddress: Address | null;
  bridge: Bridge | null;
}

export function HomeInspector({ onPhaseChange, underlyingTokenAddress, bridge }: HomeInspectorProps) {
  const selectedL1 = useSelectedL1();
  const viemChain = useViemChainStore();
  const { walletEVMAddress } = useWalletStore();
  const { deployHome, isDeploying, error } = useDeployTokenHome();

  const wellKnownRegistry = (selectedL1?.wellKnownTeleporterRegistryAddress ?? '') as Address;
  const [registry, setRegistry] = useState<string>(wellKnownRegistry);
  const [manager, setManager] = useState<string>(walletEVMAddress);
  const [decimals, setDecimals] = useState<string>('0');
  const [symbol, setSymbol] = useState<string>('');
  const [decimalsError, setDecimalsError] = useState<string | null>(null);

  useEffect(() => {
    setRegistry((prev) => prev || wellKnownRegistry);
  }, [wellKnownRegistry]);

  useEffect(() => {
    setManager((prev) => prev || walletEVMAddress);
  }, [walletEVMAddress]);

  useEffect(() => {
    if (!underlyingTokenAddress || !viemChain) return;
    let cancelled = false;
    setDecimalsError(null);
    const client = makePublicClientForChain(viemChain.rpcUrls.default.http[0], [], viemChain);
    if (!client) return;
    Promise.all([
      client.readContract({
        address: underlyingTokenAddress,
        abi: ExampleERC20.abi,
        functionName: 'decimals',
      }) as Promise<bigint>,
      client
        .readContract({
          address: underlyingTokenAddress,
          abi: ExampleERC20.abi,
          functionName: 'symbol',
        })
        .catch(() => 'TOKEN') as Promise<string>,
    ])
      .then(([d, s]) => {
        if (cancelled) return;
        setDecimals(String(d));
        setSymbol(s);
      })
      .catch((err) => {
        if (cancelled) return;
        setDecimalsError(`Could not read token decimals: ${(err as Error).message}`);
      });
    return () => {
      cancelled = true;
    };
  }, [underlyingTokenAddress, viemChain]);

  const handleDeploy = async () => {
    if (!underlyingTokenAddress) return;
    if (!/^0x[a-fA-F0-9]{40}$/.test(registry)) return;
    if (!/^0x[a-fA-F0-9]{40}$/.test(manager)) return;
    const dec = Number.parseInt(decimals, 10);
    if (!Number.isFinite(dec) || dec <= 0) return;
    // ERC-20 home is the only deploy path exposed in v2. Native-home Bridge
    // entries exist in `iccttBridgeStore` only via the legacy migration
    // (`migrations/ictt-v1-to-v2.ts`); the rest of the pipeline (send,
    // collateral) supports them so nothing breaks, but the new-bridge UX
    // assumes erc20-home. Adding native-home back into the wizard is a
    // follow-up — see plan §"Native-home decision".
    const result = await deployHome({
      kind: 'erc20-home',
      teleporterRegistryAddress: registry as Address,
      teleporterManager: manager as Address,
      minTeleporterVersion: 1,
      underlyingTokenAddress,
      decimals: dec,
      symbol,
    });
    if (result) onPhaseChange('remote');
  };

  const decimalsValid = Number.isFinite(Number.parseInt(decimals, 10)) && Number.parseInt(decimals, 10) > 0;
  const canDeploy =
    Boolean(underlyingTokenAddress) &&
    /^0x[a-fA-F0-9]{40}$/.test(registry) &&
    /^0x[a-fA-F0-9]{40}$/.test(manager) &&
    decimalsValid &&
    !isDeploying;

  return (
    <InspectorShell
      banner={
        !underlyingTokenAddress && (
          <Note variant="warning">
            <span className="text-xs">Pick a source token in Phase 1 first.</span>
          </Note>
        )
      }
      footer={
        <>
          <button
            type="button"
            onClick={handleDeploy}
            disabled={!canDeploy}
            className="inline-flex items-center gap-1 rounded-md bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
          >
            {isDeploying && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />}
            {bridge?.homeAddress ? 'Re-deploy TokenHome' : 'Deploy TokenHome'}
            {!isDeploying && <ArrowRight className="h-3.5 w-3.5" aria-hidden />}
          </button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          Deploying <span className="font-medium text-zinc-900 dark:text-zinc-100">ERC20TokenHome</span> on{' '}
          <span className="font-medium text-zinc-900 dark:text-zinc-100">{selectedL1?.name ?? 'the Home chain'}</span>.
          Your wallet must be on this chain — we&apos;ll auto-switch if needed. The constructor wires the contract to
          the Teleporter registry and your token in one transaction.
        </p>

        <FormField label="Source token" hint="Auto-filled from Phase 1.">
          <code className="block rounded-md bg-zinc-100 px-2.5 py-1.5 font-mono text-[12px] text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200">
            {underlyingTokenAddress
              ? `${truncateAddress(underlyingTokenAddress, 10, 6)}${symbol ? ` · ${symbol}` : ''}`
              : '—'}
          </code>
        </FormField>

        <FormField label="Token decimals" hint="Read from the source token contract.">
          <input
            type="number"
            min={0}
            value={decimals}
            onChange={(e) => setDecimals(e.target.value)}
            className="w-full rounded-md border border-zinc-200 bg-white px-3 py-1.5 text-sm text-zinc-900 outline-none focus:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
          />
          {decimalsError && <p className="mt-1 text-[11px] text-red-600 dark:text-red-400">{decimalsError}</p>}
        </FormField>

        <FormField label="Teleporter registry" hint="Defaults to the well-known address for this chain.">
          <input
            type="text"
            value={registry}
            onChange={(e) => setRegistry(e.target.value.trim())}
            placeholder="0x…"
            className="w-full rounded-md border border-zinc-200 bg-white px-3 py-1.5 font-mono text-xs text-zinc-900 outline-none focus:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
          />
        </FormField>

        <FormField label="Teleporter manager" hint="Address that can pause/upgrade ICM. Defaults to your wallet.">
          <input
            type="text"
            value={manager}
            onChange={(e) => setManager(e.target.value.trim())}
            placeholder="0x…"
            className="w-full rounded-md border border-zinc-200 bg-white px-3 py-1.5 font-mono text-xs text-zinc-900 outline-none focus:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
          />
        </FormField>

        {error && (
          <Note variant="destructive">
            <span className="text-xs">{error.message}</span>
          </Note>
        )}

        {bridge?.homeAddress && (
          <div className="flex items-center justify-between gap-2 rounded-lg bg-emerald-50/60 px-3 py-2 text-xs dark:bg-emerald-950/20">
            <span className="font-medium text-emerald-800 dark:text-emerald-300">TokenHome deployed</span>
            <code className="font-mono text-[11px] text-emerald-800 dark:text-emerald-300">
              {truncateAddress(bridge.homeAddress, 10, 6)}
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
