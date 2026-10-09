'use client';

import { useEffect, useState } from 'react';
import { ArrowRight } from 'lucide-react';
import { useSelectedL1, useSetTeleporterRegistryAddress } from '@/components/toolbox/stores/l1ListStore';
import { useWalletStore } from '@/components/toolbox/stores/walletStore';
import { useToolboxStore, useViemChainStore } from '@/components/toolbox/stores/toolboxStore';
import { makePublicClientForChain } from '@/components/toolbox/hooks/usePublicClientForChain';
import ExampleERC20 from '@/contracts/icm-contracts/compiled/ExampleERC20.json';
import { Alert } from '@/components/toolbox/components/Alert';
import { Button } from '@/components/toolbox/components/Button';
import { HashChip } from '@/components/explorer-v2/ui';
import { ContractDeployViewer } from '@/components/console/contract-deploy-viewer';
import { ICTT_HOME_SOURCES } from '@/lib/ictt/contractSources';
import { useDeployTokenHome } from '../hooks/useDeployTokenHome';
import { truncateAddress } from '../utils/explorer-url';
import { BODY, FIELD, Field, Inspector, MONO_FIELD, ReadOnlyValue, StatusTag } from '../ui';
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

  // Priority chain mirrors the legacy `TeleporterRegistryAddressInput`:
  //   1. user-typed value wins (handled inside `setRegistry`)
  //   2. toolboxStore — the per-chain address written by the ICM setup flow
  //      after a successful registry deploy. Catches the race window before
  //      l1ListStore propagates (and legacy users who deployed before the
  //      l1ListStore propagation existed).
  //   3. wellKnownTeleporterRegistryAddress on the L1ListItem — seeded for
  //      well-known chains (Fuji C-Chain, Echo, etc.) and now also written
  //      by the ICM setup flow for user-created L1s.
  const toolboxRegistry = useToolboxStore().teleporterRegistryAddress;
  const wellKnownRegistry = (selectedL1?.wellKnownTeleporterRegistryAddress ?? '') as Address;
  const defaultRegistry = (toolboxRegistry || wellKnownRegistry || '') as Address;
  const setTeleporterRegistryOnL1 = useSetTeleporterRegistryAddress();
  const [registry, setRegistry] = useState<string>(defaultRegistry);
  const [manager, setManager] = useState<string>(walletEVMAddress);
  const [decimals, setDecimals] = useState<string>('0');
  const [symbol, setSymbol] = useState<string>('');
  const [decimalsError, setDecimalsError] = useState<string | null>(null);

  useEffect(() => {
    setRegistry((prev) => prev || defaultRegistry);
  }, [defaultRegistry]);

  // One-time backfill: if the toolboxStore has a registry that the L1ListItem
  // doesn't yet know about, propagate it now. Heals legacy state where the
  // user ran ICM setup before the propagation in `TeleporterRegistry.tsx`
  // existed. Skip when wallet isn't on this L1 — `useSetTeleporterRegistryAddress`
  // matches by `walletChainId`, so writing while on the wrong chain would
  // silently miss.
  useEffect(() => {
    if (!toolboxRegistry || wellKnownRegistry) return;
    if (!selectedL1 || selectedL1.evmChainId !== useWalletStore.getState().walletChainId) return;
    setTeleporterRegistryOnL1(toolboxRegistry);
  }, [toolboxRegistry, wellKnownRegistry, selectedL1, setTeleporterRegistryOnL1]);

  const registryHint = toolboxRegistry
    ? 'Defaults to your deployed ICM Registry on this chain.'
    : wellKnownRegistry
      ? 'Defaults to the well-known address for this chain.'
      : 'Run ICM setup on this L1 to get a default — or paste a known Registry address.';

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
    <ContractDeployViewer contracts={ICTT_HOME_SOURCES}>
      <Inspector
        label="Phase 2 · TokenHome"
        banner={!underlyingTokenAddress && <Alert variant="warning">Pick a source token in Phase 1 first.</Alert>}
        footer={
          <Button
            onClick={handleDeploy}
            disabled={!canDeploy}
            loading={isDeploying}
            loadingText="Deploying TokenHome…"
            className="w-auto"
            icon={<ArrowRight className="h-3.5 w-3.5" aria-hidden />}
          >
            {bridge?.homeAddress ? 'Re-deploy TokenHome' : 'Deploy TokenHome'}
          </Button>
        }
      >
        <div className="flex flex-col gap-5">
          <p className={BODY}>
            Deploys <span className="font-medium text-zinc-900 dark:text-zinc-100">ERC20TokenHome</span> on{' '}
            <span className="font-medium text-zinc-900 dark:text-zinc-100">{selectedL1?.name ?? 'the Home chain'}</span>
            . Your wallet must be on this chain; it switches for you if needed. One transaction wires the contract to
            the Teleporter registry and your token.
          </p>

          <div className="grid grid-cols-1 gap-5 md:grid-cols-[minmax(0,1fr)_10rem]">
            <Field label="Source token" hint="Filled in from Phase 1.">
              <ReadOnlyValue>
                {underlyingTokenAddress
                  ? `${truncateAddress(underlyingTokenAddress, 10, 6)}${symbol ? ` · ${symbol}` : ''}`
                  : '—'}
              </ReadOnlyValue>
            </Field>

            <Field
              label="Decimals"
              htmlFor="ictt-home-decimals"
              hint={decimalsError ? undefined : 'Read from the token.'}
              error={decimalsError}
            >
              <input
                id="ictt-home-decimals"
                type="number"
                min={0}
                value={decimals}
                onChange={(e) => setDecimals(e.target.value)}
                className={`${FIELD} font-mono tabular-nums`}
              />
            </Field>
          </div>

          <Field label="Teleporter registry" htmlFor="ictt-home-registry" hint={registryHint}>
            <input
              id="ictt-home-registry"
              type="text"
              value={registry}
              onChange={(e) => setRegistry(e.target.value.trim())}
              placeholder="0x…"
              className={MONO_FIELD}
            />
          </Field>

          <Field
            label="Teleporter manager"
            htmlFor="ictt-home-manager"
            hint="Can pause or upgrade ICM on this contract. Defaults to your wallet."
          >
            <input
              id="ictt-home-manager"
              type="text"
              value={manager}
              onChange={(e) => setManager(e.target.value.trim())}
              placeholder="0x…"
              className={MONO_FIELD}
            />
          </Field>

          {error && <Alert variant="error">{error.message}</Alert>}

          {bridge?.homeAddress && (
            <div className="flex flex-wrap items-center justify-between gap-3 border border-emerald-300 px-4 py-3 dark:border-emerald-900">
              <StatusTag tone="ok">TokenHome deployed</StatusTag>
              <HashChip value={bridge.homeAddress} len={14} />
            </div>
          )}
        </div>
      </Inspector>
    </ContractDeployViewer>
  );
}
