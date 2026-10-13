'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ChevronRight, Waypoints } from 'lucide-react';
import { Board, INK, MUTED, SectionHeader, idInk } from '@/components/explorer-v2/ui';
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
import { BoardBone, HowItWorks, Runner, StatusMark, networkNamesOf } from './Runner';
import { Appear, Button, EmptyState, INPUT, LABEL, Notice, Pill, shortId } from './ui';

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

/** The one action the pane leads with, so only one button on it is ink. */
type Lead = 'runner' | 'registry' | 'launch' | 'plan' | null;

const ROW_NAME = 'truncate text-[13.5px] font-medium text-zinc-900 dark:text-zinc-50';
const ROW_HELP = 'mt-1 block text-[13px] leading-relaxed text-zinc-500 dark:text-zinc-400';

function Roles({
  overview,
  blueprints,
  lead,
  onChanged,
  onOpenPlan,
}: {
  overview: ProjectOverview;
  blueprints: BlueprintCard[];
  lead: Lead;
  onChanged: () => void;
  onOpenPlan?: () => void;
}) {
  const { project } = overview;
  const bound = project.runtime.testnet?.l1 as Bound;
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
  if (roles.length === 0) {
    return (
      <EmptyState
        icon={Waypoints}
        title="No roles yet"
        action={
          onOpenPlan && (
            <Button variant={lead === 'plan' ? 'primary' : 'secondary'} onClick={onOpenPlan}>
              Open Plan
            </Button>
          )
        }
      >
        Pick a blueprint on the Plan tab, or ask Studio for one.
      </EmptyState>
    );
  }
  return (
    <>
      <p className="text-[13px] text-zinc-500 dark:text-zinc-400">Choose the testnet that plays each role.</p>
      <Board divide={false}>
        <div className="-mb-px grid sm:grid-cols-2">
          {roles.map(([role, network]) => {
            const choices = options(role);
            return (
              <div
                key={role}
                className="flex min-w-0 items-center gap-4 border-b border-zinc-200 px-5 py-2.5 sm:odd:border-r md:px-6 dark:border-zinc-800"
              >
                <span className="w-16 shrink-0 font-mono text-[10px] font-medium uppercase tracking-[0.16em] text-zinc-400">
                  {role}
                </span>
                {network === 'l1' ? (
                  // The L1 role is played by the L1 bound below, not by a network to choose here.
                  bound ? (
                    <span className={cn(INK, 'min-w-0 break-words')}>{bound.name ?? 'Your L1'}</span>
                  ) : (
                    <StatusMark tone="warn">None bound</StatusMark>
                  )
                ) : choices.length > 1 ? (
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
                  <span className={cn(INK, 'min-w-0 break-words')}>{choices[0]?.[1] ?? network}</span>
                )}
              </div>
            );
          })}
        </div>
        {error && (
          <div className="px-5 py-3 md:px-6">
            <Notice tone="bad">{error}</Notice>
          </div>
        )}
      </Board>
    </>
  );
}

/** The list's shape while the managed nodes and the registry load. */
function L1Skeleton({ collapsed, rows }: { collapsed: boolean; rows: number }) {
  return (
    <div aria-busy="true" aria-label="Loading your L1s" className="divide-y divide-zinc-200 dark:divide-zinc-800">
      {rows === 0 ? (
        <div className="flex px-5 py-3.5 md:px-6">
          <span className="flex h-5 items-center">
            <BoardBone className="h-3 w-40" />
          </span>
        </div>
      ) : (
        Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 px-5 py-3 md:px-6">
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="flex h-5 items-center">
                <BoardBone className="h-3.5 w-40" delay={i * 0.04} />
              </span>
              <span className="mt-0.5 flex h-[16.5px] items-center">
                <BoardBone className="h-2.5 w-56 max-w-full" delay={i * 0.04} />
              </span>
            </span>
            <BoardBone className="h-8 w-16" delay={i * 0.04} />
          </div>
        ))
      )}
      {collapsed ? (
        <div className="flex px-5 py-4 md:px-6">
          <span className="flex h-4 items-center">
            <BoardBone className="h-2.5 w-36" delay={0.04} />
          </span>
        </div>
      ) : (
        <div className="flex flex-col gap-3 px-5 py-4 md:px-6">
          <span className="flex h-[15px] items-center">
            <BoardBone className="h-2.5 w-28" />
          </span>
          <div className="grid gap-3 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_auto]">
            <BoardBone className="h-8" delay={0.04} />
            <BoardBone className="h-8" delay={0.08} />
            <BoardBone className="h-8 w-20" delay={0.12} />
          </div>
          <span className="flex h-5 items-center">
            <BoardBone className="h-3 w-96 max-w-full" delay={0.16} />
          </span>
          <span className="flex h-[15px] items-center">
            <BoardBone className="h-2.5 w-28" delay={0.16} />
          </span>
        </div>
      )}
    </div>
  );
}

/** The last answer from /api/studio/l1s, so coming back to the tab paints the list at once while it refreshes. */
let VOUCHERS: Vouchers | null = null;

function YourL1s({
  projectId,
  overview,
  lead,
  collapsed,
  onChanged,
  onLaunch,
}: {
  projectId: string;
  overview: ProjectOverview;
  lead: Lead;
  /** Folds the launch form when an L1 is already bound or launching, or the project has no roles yet. */
  collapsed: boolean;
  onChanged: () => void;
  onLaunch: (chainName: string, tokenSymbol: string) => Promise<void>;
}) {
  const consoleL1s = getL1ListStore(true)((state: { l1List: L1ListItem[] }) => state.l1List);
  const [vouchers, setVouchers] = useState<Vouchers | null>(() => VOUCHERS);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [chainName, setChainName] = useState('');
  const [tokenSymbol, setTokenSymbol] = useState('');
  const [launching, setLaunching] = useState(false);
  const bound = overview.project.runtime.testnet?.l1 as Bound;

  useEffect(() => {
    api<Vouchers>('/api/studio/l1s')
      .then((v) => {
        VOUCHERS = v;
        setVouchers(v);
      })
      .catch(() => setVouchers((v) => v ?? { nodes: [], registry: [], quickL1: { available: false } }));
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

  const unbindButton = (
    <Button variant="ghost" busy={busyKey === 'unbind'} onClick={() => void unbind()}>
      Unbind
    </Button>
  );
  // The bound L1 may be neither in the console's list nor a managed node, e.g. one bound from the registry.
  const boundListed = !!bound && rows.some((r) => r.blockchainId === bound.blockchainId);

  const launchForm =
    vouchers && !vouchers.quickL1.available ? (
      <div className="flex flex-col gap-1.5">
        <StatusMark tone="warn">Quick L1 unavailable</StatusMark>
        {vouchers.quickL1.reason && (
          <p className="text-[13px] leading-relaxed text-zinc-500 dark:text-zinc-400">{vouchers.quickL1.reason}</p>
        )}
      </div>
    ) : (
      <div className="flex flex-col gap-3">
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
            variant={lead === 'launch' ? 'primary' : 'secondary'}
            onClick={() => void launch()}
            busy={launching}
            disabled={
              !vouchers?.quickL1.available || !/^[a-zA-Z0-9 ]{1,64}$/.test(chainName.trim()) || !tokenSymbol.trim()
            }
          >
            Launch
          </Button>
        </div>
        <p className="text-[12.5px] leading-relaxed text-zinc-500 dark:text-zinc-400">
          Quick L1 launches a Fuji L1 with a managed validator, ICM and a relayer to the C-Chain.
        </p>
        <HowItWorks>
          The Quick L1 service signs the launch, and your wallet becomes the owner. Studio binds the L1 to this project
          when it is live.
        </HowItWorks>
      </div>
    );

  return (
    <section className="flex flex-col gap-3">
      <SectionHeader label="Your L1s" />
      <Board>
        {vouchers === null ? (
          // The console's own L1 list and the bound L1 are known already; managed nodes arrive with the answer.
          <L1Skeleton collapsed={collapsed} rows={rows.length + (bound && !boundListed ? 1 : 0)} />
        ) : (
          <Appear className="divide-y divide-zinc-200 dark:divide-zinc-800">
            {bound && !boundListed && (
              <div className="flex items-center gap-3 px-5 py-3 md:px-6">
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2.5">
                    <span className={ROW_NAME}>{bound.name ?? 'Your L1'}</span>
                    <StatusMark tone="good">In use</StatusMark>
                  </span>
                  <span className={cn(MUTED, 'mt-0.5 block truncate text-[11px]')}>
                    {bound.evmChainId ? `chain ${bound.evmChainId}` : 'bound to this project'}
                    {bound.blockchainId ? ` · ${shortId(bound.blockchainId, 8, 6)}` : ''}
                  </span>
                </span>
                {unbindButton}
              </div>
            )}
            {rows.map((row) => {
              const usable = !!row.nodeId || row.listed;
              const inUse = bound?.blockchainId === row.blockchainId;
              return (
                <div key={row.key} className="flex items-center gap-3 px-5 py-3 md:px-6">
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2.5">
                      <span className={ROW_NAME}>{row.name}</span>
                      {inUse && <StatusMark tone="good">In use</StatusMark>}
                      {row.nodeId && <Pill tone="info">managed node</Pill>}
                      {!row.nodeId && row.listed && <Pill>registry</Pill>}
                    </span>
                    <span className={cn(MUTED, 'mt-0.5 block truncate text-[11px]')}>
                      {row.evmChainId ? `chain ${row.evmChainId} · ` : ''}
                      {shortId(row.blockchainId, 8, 6)}
                      {row.expiresAt ? ` · node expires ${new Date(row.expiresAt).toLocaleDateString()}` : ''}
                      {!usable && !inUse ? ' · needs a managed node or a registry listing' : ''}
                    </span>
                  </span>
                  {inUse
                    ? unbindButton
                    : usable && (
                        <Button variant="secondary" busy={busyKey === row.key} onClick={() => void use(row)}>
                          Use
                        </Button>
                      )}
                </div>
              );
            })}
            {!bound && rows.length === 0 && (
              <p className="px-5 py-3.5 text-[13px] text-zinc-500 md:px-6 dark:text-zinc-400">
                No L1s of your own yet.
              </p>
            )}
            <div className="px-5 py-4 md:px-6">
              {collapsed ? (
                <details className="group">
                  <summary
                    className={cn(
                      LABEL,
                      'flex w-fit cursor-pointer select-none list-none items-center gap-1 hover:text-zinc-900 dark:hover:text-zinc-100 [&::-webkit-details-marker]:hidden',
                    )}
                  >
                    <ChevronRight className="h-3 w-3 transition-transform group-open:rotate-90" />
                    {bound || rows.length > 0 ? 'Launch another L1' : 'Launch an L1'}
                  </summary>
                  <div className="mt-3">{launchForm}</div>
                </details>
              ) : (
                <div className="flex flex-col gap-3">
                  <span className={LABEL}>Launch a new L1</span>
                  {launchForm}
                </div>
              )}
            </div>
          </Appear>
        )}
        {error && (
          <div className="px-5 py-4 md:px-6">
            <Notice tone="bad">{error}</Notice>
          </div>
        )}
      </Board>
    </section>
  );
}

/** What a bound L1 still lacks for ICM: a registry (Studio deploys it) and a relayer (the builder sets it up). */
function FinishIcm({
  overview,
  lead,
  onDeployRegistry,
  onChanged,
}: {
  overview: ProjectOverview;
  lead: Lead;
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
  const name = l1.name ?? 'your L1';

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
      <SectionHeader label={`Finish ICM on ${name}`} />
      <Board>
        {missingRegistry && (
          <div className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center md:px-6">
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-2.5">
                <span className={ROW_NAME}>ICM registry</span>
                <StatusMark tone="warn">Missing</StatusMark>
              </span>
              <span className={ROW_HELP}>ICM and ICTT blueprints need it. Your wallet deploys it on the L1.</span>
            </span>
            <span className="shrink-0">
              <Button
                variant={lead === 'registry' ? 'primary' : 'secondary'}
                busy={busy === 'registry'}
                onClick={() => void run('registry', onDeployRegistry)}
              >
                Deploy registry
              </Button>
            </span>
          </div>
        )}
        {relayerDown && (
          <div className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center md:px-6">
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-2.5">
                <span className={ROW_NAME}>Managed relayer</span>
                <StatusMark tone="warn">Not running</StatusMark>
              </span>
              <span className={ROW_HELP}>
                Add {name} and the C-Chain to a relayer under{' '}
                <Link href="/console/testnet-infra/icm-relayer" className={idInk}>
                  ICM Relayer
                </Link>
                , then confirm it here.
              </span>
            </span>
            <span className="shrink-0">
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
                Confirm relayer
              </Button>
            </span>
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
  onOpenPlan,
}: {
  overview: ProjectOverview;
  blueprints: BlueprintCard[];
  autoRunId: string | null;
  onPlanned: (deploymentId: string, autoRun: boolean) => void;
  onChanged: () => void;
  /** Opens the Plan tab, where a project gets the blueprints that define its roles. */
  onOpenPlan?: () => void;
}) {
  const { project } = overview;
  const l1 = project.runtime.testnet?.l1;
  const networkNames = useMemo(
    () => ({ ...networkNamesOf(blueprints), ...(l1?.name ? { l1: l1.name } : {}) }),
    [blueprints, l1?.name],
  );
  const launches = overview.deployments.filter(
    (d) => d.blueprint_id === L1_BLUEPRINT || d.blueprint_id === ICM_SETUP_BLUEPRINT,
  );
  const launch =
    launches.find((d) => d.id === autoRunId) ?? launches.find((d) => d.status === 'proposed' || d.status === 'running');
  const launchId = launch?.id;
  const noRoles = Object.keys(project.networks).length === 0;

  const needsL1 = Object.values(project.networks).includes('l1');
  const missingRegistry = !!l1 && !l1.teleporter?.registry && !!l1.teleporter?.messenger;
  const lead: Lead = launchId
    ? 'runner'
    : missingRegistry
      ? 'registry'
      : needsL1 && !l1
        ? 'launch'
        : noRoles
          ? 'plan'
          : null;

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
        <Roles overview={overview} blueprints={blueprints} lead={lead} onChanged={onChanged} onOpenPlan={onOpenPlan} />
      </section>

      {launchId && (
        <section className="flex flex-col gap-3">
          <SectionHeader label={launch?.blueprint_id === L1_BLUEPRINT ? 'Launch' : 'ICM setup'} />
          <Runner
            key={launchId}
            projectId={project.id}
            deploymentId={launchId}
            autoStart={autoRunId === launchId}
            onChanged={onChanged}
            onFinishSetup={deployRegistry}
            networkNames={networkNames}
            skeleton={{
              rows: blueprints.find((b) => b.id === launch?.blueprint_id)?.steps,
              steps: blueprints.find((b) => b.id === launch?.blueprint_id)?.outline,
              started: launch?.status !== 'proposed',
              finished: launch?.status === 'succeeded' || launch?.status === 'failed' || launch?.status === 'cancelled',
            }}
          />
        </section>
      )}

      <FinishIcm overview={overview} lead={lead} onDeployRegistry={deployRegistry} onChanged={onChanged} />

      <YourL1s
        projectId={project.id}
        overview={overview}
        lead={lead}
        collapsed={!!l1 || !!launchId || noRoles}
        onChanged={onChanged}
        onLaunch={launchL1}
      />
    </div>
  );
}
