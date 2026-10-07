'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Board, EmptyRow, INK, MUTED, SectionHeader, idInk } from '@/components/explorer-v2/ui';
import { BUILT_IN_TESTNET_L1_IDS, getL1ListStore, type L1ListItem } from '@/components/toolbox/stores/l1ListStore';
import { cn } from '@/lib/utils';
import {
  ICM_SETUP_BLUEPRINT,
  L1_BLUEPRINT,
  api,
  errorText,
  planDeployment,
  type BlueprintCard,
  type ProjectOverview,
} from './api';
import { Runner } from './Runner';
import { Button, INPUT, LABEL, Notice, Pill, shortId } from './ui';

interface Vouchers {
  nodes: { id: string; chainName: string | null; blockchainId: string; subnetId: string; expiresAt: string }[];
  registry: { evmChainId: number; name: string; blockchainId: string | null; testnet: boolean }[];
  quickL1: { available: boolean; reason?: string };
}

interface L1Row {
  key: string;
  name: string;
  blockchainId: string;
  evmChainId?: number;
  nodeId?: string;
  expiresAt?: string;
  listed: boolean;
  teleporterRegistry?: string;
}

type Bound = { name?: string; evmChainId?: number; blockchainId?: string; relayer?: 'not-running' } | undefined;

function Roles({
  overview,
  blueprints,
  onChanged,
}: {
  overview: ProjectOverview;
  blueprints: BlueprintCard[];
  onChanged: () => void;
}) {
  const { project } = overview;
  const [error, setError] = useState<string | null>(null);
  const options = (role: string) => {
    const seen = new Map<string, string>();
    for (const b of blueprints.filter((b) => project.blueprint_ids.includes(b.id))) {
      for (const n of b.networks[role]?.allowed ?? []) if (n.testnet) seen.set(n.key, n.name);
    }
    return [...seen];
  };
  const change = async (role: string, network: string) => {
    setError(null);
    try {
      await api(`/api/studio/projects/${project.id}`, { method: 'PATCH', json: { networks: { [role]: network } } });
      onChanged();
    } catch (e) {
      setError(errorText(e));
    }
  };

  const roles = Object.entries(project.networks);
  return (
    <Board divide={false}>
      {roles.length === 0 ? (
        <EmptyRow>Add a blueprint (ask Studio, or pick one under Deploy) to choose networks.</EmptyRow>
      ) : (
        <div className="-mb-px grid sm:grid-cols-2">
          {roles.map(([role, network]) => {
            const choices = options(role);
            return (
              <div
                key={role}
                className="flex min-w-0 items-center gap-4 border-b border-zinc-200 px-5 py-2.5 sm:odd:border-r md:px-6 dark:border-zinc-800"
              >
                <span className="w-20 shrink-0 font-mono text-[10px] font-medium uppercase tracking-[0.16em] text-zinc-400">
                  {role}
                </span>
                {choices.length > 1 ? (
                  <select
                    value={network}
                    onChange={(e) => void change(role, e.target.value)}
                    className={cn(INPUT, 'min-w-0 flex-1')}
                    aria-label={`Network for ${role}`}
                  >
                    {choices.map(([key, name]) => (
                      <option key={key} value={key}>
                        {name}
                      </option>
                    ))}
                  </select>
                ) : (
                  <span className={cn(INK, 'truncate')}>{choices[0]?.[1] ?? network}</span>
                )}
              </div>
            );
          })}
        </div>
      )}
      {error && (
        <div className="px-5 py-3 md:px-6">
          <Notice tone="bad">{error}</Notice>
        </div>
      )}
    </Board>
  );
}

function YourL1s({
  projectId,
  overview,
  onChanged,
  onLaunch,
}: {
  projectId: string;
  overview: ProjectOverview;
  onChanged: () => void;
  onLaunch: (chainName: string, tokenSymbol: string) => Promise<void>;
}) {
  const consoleL1s = getL1ListStore(true)((state: { l1List: L1ListItem[] }) => state.l1List);
  const [vouchers, setVouchers] = useState<Vouchers | null>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [chainName, setChainName] = useState('');
  const [tokenSymbol, setTokenSymbol] = useState('');
  const [launching, setLaunching] = useState(false);
  const bound = overview.project.runtime.testnet?.l1 as Bound;

  useEffect(() => {
    api<Vouchers>('/api/studio/l1s')
      .then(setVouchers)
      .catch(() => setVouchers({ nodes: [], registry: [], quickL1: { available: false } }));
  }, []);

  const unbind = async () => {
    setBusyKey('unbind');
    setError(null);
    try {
      await api(`/api/studio/projects/${projectId}/l1?stage=testnet`, { method: 'DELETE' });
      onChanged();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusyKey(null);
    }
  };

  // The console's built-in testnets are not the builder's; Echo and Dispatch are already choices under Roles.
  const rows = useMemo<L1Row[]>(() => {
    const nodes = vouchers?.nodes ?? [];
    const registry = vouchers?.registry ?? [];
    const out: L1Row[] = [];
    for (const l1 of consoleL1s) {
      if (!l1.isTestnet || BUILT_IN_TESTNET_L1_IDS.has(l1.id)) continue;
      const node = nodes.find((n) => n.blockchainId === l1.id);
      out.push({
        key: l1.id,
        name: l1.name,
        blockchainId: l1.id,
        evmChainId: l1.evmChainId,
        nodeId: node?.id,
        expiresAt: node?.expiresAt,
        listed: registry.some(
          (r) => r.testnet && r.evmChainId === l1.evmChainId && (!r.blockchainId || r.blockchainId === l1.id),
        ),
        teleporterRegistry: l1.wellKnownTeleporterRegistryAddress,
      });
    }
    for (const node of nodes) {
      if (out.some((r) => r.blockchainId === node.blockchainId)) continue;
      out.push({
        key: node.id,
        name: node.chainName ?? 'Managed L1',
        blockchainId: node.blockchainId,
        nodeId: node.id,
        expiresAt: node.expiresAt,
        listed: false,
      });
    }
    return out;
  }, [consoleL1s, vouchers]);

  const use = async (row: L1Row) => {
    setBusyKey(row.key);
    setError(null);
    try {
      const source = row.nodeId
        ? { kind: 'node', nodeId: row.nodeId }
        : { kind: 'console', blockchainId: row.blockchainId, evmChainId: row.evmChainId };
      await api(`/api/studio/projects/${projectId}/l1`, {
        method: 'POST',
        json: {
          stage: 'testnet',
          source,
          ...(row.teleporterRegistry ? { teleporterRegistry: row.teleporterRegistry } : {}),
        },
      });
      onChanged();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusyKey(null);
    }
  };

  const launch = async () => {
    setLaunching(true);
    setError(null);
    try {
      await onLaunch(chainName.trim(), tokenSymbol.trim());
      setChainName('');
      setTokenSymbol('');
    } catch (e) {
      setError(errorText(e));
    } finally {
      setLaunching(false);
    }
  };

  return (
    <>
      <SectionHeader
        label="Your L1s"
        action={
          bound ? (
            <span className="flex min-w-0 items-center gap-3">
              <span className={cn(MUTED, 'truncate text-[11px]')}>in use: {bound.name}</span>
              {bound.relayer === 'not-running' && <Pill tone="warn">relayer not running</Pill>}
              <Button variant="ghost" className="h-6 px-1" busy={busyKey === 'unbind'} onClick={() => void unbind()}>
                Unbind
              </Button>
            </span>
          ) : (
            <Pill tone="warn">none bound</Pill>
          )
        }
      />
      <Board>
        {vouchers === null ? (
          <EmptyRow>Loading your L1s…</EmptyRow>
        ) : rows.length === 0 ? (
          <EmptyRow>
            No L1s of your own yet. Launch one below. Public testnets such as Echo and Dispatch are already choices
            under Roles.
          </EmptyRow>
        ) : (
          rows.map((row) => {
            const usable = !!row.nodeId || row.listed;
            const inUse = bound?.blockchainId === row.blockchainId;
            return (
              <div key={row.key} className="flex items-center gap-3 px-5 py-2.5 md:px-6">
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2">
                    <span className="truncate text-[13.5px] font-medium text-zinc-900 dark:text-zinc-50">
                      {row.name}
                    </span>
                    {row.nodeId && <Pill tone="info">managed node</Pill>}
                    {!row.nodeId && row.listed && <Pill>registry</Pill>}
                  </span>
                  <span className={cn(MUTED, 'block truncate text-[11px]')}>
                    {row.evmChainId ? `chain ${row.evmChainId} · ` : ''}
                    {shortId(row.blockchainId, 8, 6)}
                    {row.expiresAt ? ` · node expires ${new Date(row.expiresAt).toLocaleDateString()}` : ''}
                    {!usable && !inUse ? ' · Studio needs a managed node or a registry listing to use it' : ''}
                  </span>
                </span>
                {inUse ? (
                  <Pill tone="good">in use</Pill>
                ) : (
                  <Button
                    variant="secondary"
                    disabled={!usable}
                    busy={busyKey === row.key}
                    onClick={() => void use(row)}
                  >
                    Use
                  </Button>
                )}
              </div>
            );
          })
        )}
        <div className="flex flex-col gap-3 px-5 py-4 md:px-6">
          <span className={LABEL}>Launch a new L1</span>
          <div className="grid gap-3 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_auto]">
            <input
              value={chainName}
              onChange={(e) => setChainName(e.target.value)}
              placeholder="Chain name, e.g. Moon Chain"
              className={INPUT}
              aria-label="Chain name"
            />
            <input
              value={tokenSymbol}
              onChange={(e) => setTokenSymbol(e.target.value.toUpperCase())}
              placeholder="Symbol, e.g. MOON"
              className={INPUT}
              aria-label="Token symbol"
            />
            <Button
              onClick={() => void launch()}
              busy={launching}
              disabled={
                !vouchers?.quickL1.available || !/^[a-zA-Z0-9 ]{1,64}$/.test(chainName.trim()) || !tokenSymbol.trim()
              }
            >
              Launch
            </Button>
          </div>
          {vouchers && !vouchers.quickL1.available ? (
            <Notice tone="warn">{vouchers.quickL1.reason}</Notice>
          ) : (
            <span className="font-mono text-[10px] text-zinc-400 dark:text-zinc-500">
              Quick L1 on Fuji: a managed validator, ICM and a relayer to the C-Chain. The Quick L1 service signs the
              launch; your wallet becomes the owner. Studio binds the L1 to this project when it is live.
            </span>
          )}
        </div>
        {error && (
          <div className="px-5 pb-4 md:px-6">
            <Notice tone="bad">{error}</Notice>
          </div>
        )}
      </Board>
    </>
  );
}

/** What a bound L1 still lacks for ICM: a registry (Studio deploys it) and a relayer (the builder sets it up). */
function FinishIcm({
  overview,
  onDeployRegistry,
  onChanged,
}: {
  overview: ProjectOverview;
  onDeployRegistry: () => Promise<void>;
  onChanged: () => void;
}) {
  const l1 = overview.project.runtime.testnet?.l1;
  const [busy, setBusy] = useState<'registry' | 'relayer' | null>(null);
  const [error, setError] = useState<string | null>(null);
  if (!l1) return null;
  const missingRegistry = !l1.teleporter?.registry && !!l1.teleporter?.messenger;
  const relayerDown = l1.relayer === 'not-running';
  if (!missingRegistry && !relayerDown) return null;

  const run = async (which: 'registry' | 'relayer', action: () => Promise<unknown>) => {
    setBusy(which);
    setError(null);
    try {
      await action();
      onChanged();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(null);
    }
  };

  return (
    <section className="flex flex-col gap-3">
      <SectionHeader label={`Finish ICM on ${l1.name ?? 'your L1'}`} />
      <Board>
        {missingRegistry && (
          <div className="flex items-center gap-3 px-5 py-3 md:px-6">
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-2">
                <span className="text-[13.5px] font-medium text-zinc-900 dark:text-zinc-50">ICM registry</span>
                <Pill tone="warn">missing</Pill>
              </span>
              <span className={cn(MUTED, 'block text-[11px]')}>
                ICM and ICTT blueprints need it. Your wallet deploys it on the L1; the launch stopped before that step.
              </span>
            </span>
            <Button busy={busy === 'registry'} onClick={() => void run('registry', onDeployRegistry)}>
              Deploy registry
            </Button>
          </div>
        )}
        {relayerDown && (
          <div className="flex items-center gap-3 px-5 py-3 md:px-6">
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-2">
                <span className="text-[13.5px] font-medium text-zinc-900 dark:text-zinc-50">Managed relayer</span>
                <Pill tone="warn">not running</Pill>
              </span>
              <span className={cn(MUTED, 'block text-[11px]')}>
                Add this L1 and the C-Chain to a relayer under{' '}
                <Link href="/console/testnet-infra/icm-relayer" className={idInk}>
                  ICM Relayer
                </Link>
                , fund it, then tell Studio. Studio cannot see relayers itself.
              </span>
            </span>
            <Button
              variant="secondary"
              busy={busy === 'relayer'}
              onClick={() =>
                void run('relayer', () =>
                  api(`/api/studio/projects/${overview.project.id}/l1`, {
                    method: 'PATCH',
                    json: { stage: 'testnet', relayerRunning: true },
                  }),
                )
              }
            >
              A relayer is running
            </Button>
          </div>
        )}
        {error && (
          <div className="px-5 pb-4 md:px-6">
            <Notice tone="bad">{error}</Notice>
          </div>
        )}
      </Board>
    </section>
  );
}

/** Which chain plays each blueprint role, the project's own L1, and launching a new one. */
export function NetworksPanel({
  overview,
  blueprints,
  autoRunId,
  onPlanned,
  onChanged,
}: {
  overview: ProjectOverview;
  blueprints: BlueprintCard[];
  autoRunId: string | null;
  onPlanned: (deploymentId: string, autoRun: boolean) => void;
  onChanged: () => void;
}) {
  const { project } = overview;
  const launches = overview.deployments.filter(
    (d) => d.blueprint_id === L1_BLUEPRINT || d.blueprint_id === ICM_SETUP_BLUEPRINT,
  );
  const launchId =
    launches.find((d) => d.id === autoRunId)?.id ??
    launches.find((d) => d.status === 'proposed' || d.status === 'running')?.id;

  const plan = async (blueprintId: string, params: Record<string, unknown>) => {
    if (!project.blueprint_ids.includes(blueprintId)) {
      await api(`/api/studio/projects/${project.id}/blueprints`, { method: 'POST', json: { blueprintId } });
    }
    onPlanned(await planDeployment(project.id, blueprintId, params), true);
  };
  const launchL1 = (chainName: string, tokenSymbol: string) => plan(L1_BLUEPRINT, { chainName, tokenSymbol });
  const deployRegistry = () => plan(ICM_SETUP_BLUEPRINT, {});

  return (
    <div className="flex flex-col gap-8">
      <section className="flex flex-col gap-3">
        <SectionHeader label="Roles" />
        <p className={cn(MUTED, 'text-[12px]')}>
          Each blueprint names the chains it works with. Choose the testnet that plays each role.
        </p>
        <Roles overview={overview} blueprints={blueprints} onChanged={onChanged} />
      </section>

      <section className="flex flex-col gap-3">
        <YourL1s projectId={project.id} overview={overview} onChanged={onChanged} onLaunch={launchL1} />
      </section>

      <FinishIcm overview={overview} onDeployRegistry={deployRegistry} onChanged={onChanged} />

      {launchId && (
        <section className="flex flex-col gap-3">
          <SectionHeader label="Setup" />
          <Runner
            key={launchId}
            projectId={project.id}
            deploymentId={launchId}
            autoStart={autoRunId === launchId}
            onChanged={onChanged}
            onFinishSetup={deployRegistry}
          />
        </section>
      )}
    </div>
  );
}
