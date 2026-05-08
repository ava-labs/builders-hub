'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Sparkles } from 'lucide-react';
import { useWalletStore } from '@/components/toolbox/stores/walletStore';
import { useSelectedL1 } from '@/components/toolbox/stores/l1ListStore';
import { useIcttBridgeStore } from '@/components/toolbox/stores/iccttBridgeStore';
import { cn } from '@/lib/utils';
import { BRIDGE_PHASE_ORDER, PHASE_LABEL, type Address, type BridgePhase, type Bridge, type Remote } from './types';
import { BridgeHeader } from './BridgeHeader';
import { PhaseStrip } from './PhaseStrip';
import { HomeChainCard } from './HomeChainCard';
import { RemoteChainCard } from './RemoteChainCard';
import { ICMRail } from './ICMRail';
import { RemoteTabs } from './RemoteTabs';
import { ChainCardSkeleton } from './ChainCardSkeleton';
import { ActivityRail } from './activity/ActivityRail';
import { ActivityDrawer } from './activity/ActivityDrawer';
import { useBridgePhase } from './hooks/useBridgePhase';
import { useBridgeState } from './hooks/useBridgeState';
import { useBridgeActivity } from './hooks/useBridgeActivity';
import { useBridgeRemotes } from './hooks/useBridgeRemotes';
import { useMigrationOnce } from './hooks/useMigrationOnce';
import { TokenInspector } from './inspectors/TokenInspector';
import { HomeInspector } from './inspectors/HomeInspector';
import { RemoteInspector } from './inspectors/RemoteInspector';

interface BridgeShellProps {
  initialPhase?: string;
  initialRemote?: string;
}

export function BridgeShell({ initialPhase: _initialPhase, initialRemote: _initialRemote }: BridgeShellProps) {
  const migration = useMigrationOnce();
  const bridgesRecord = useIcttBridgeStore((s) => s.bridges);
  const lastActiveBridgeId = useIcttBridgeStore((s) => s.lastActiveBridgeId);
  const setLastActiveBridge = useIcttBridgeStore((s) => s.setLastActiveBridge);
  const selectedL1 = useSelectedL1();

  const visibleBridges = useMemo(() => Object.values(bridgesRecord).filter((b) => !b.archivedAt), [bridgesRecord]);

  const activeBridgeId = useMemo(() => {
    if (lastActiveBridgeId && bridgesRecord[lastActiveBridgeId]) return lastActiveBridgeId;
    return visibleBridges[0]?.id ?? null;
  }, [bridgesRecord, lastActiveBridgeId, visibleBridges]);

  useEffect(() => {
    if (activeBridgeId && activeBridgeId !== lastActiveBridgeId) {
      setLastActiveBridge(activeBridgeId);
    }
  }, [activeBridgeId, lastActiveBridgeId, setLastActiveBridge]);

  const { remotes, selectedRemoteId, selectRemote } = useBridgeRemotes(activeBridgeId);
  const { phase, setPhase, setRemoteId } = useBridgePhase('token');

  useEffect(() => {
    if (selectedRemoteId) setRemoteId(selectedRemoteId);
  }, [selectedRemoteId, setRemoteId]);

  const state = useBridgeState({ bridgeId: activeBridgeId, remoteId: selectedRemoteId });
  const { events: activityEvents, clear: clearActivity } = useBridgeActivity(activeBridgeId, selectedRemoteId);
  const walletChainId = useWalletStore((s) => s.walletChainId);

  // Tentative source-token address held while the user is in Phase 1 with no
  // bridge yet. Once a TokenHome is deployed in Phase 2, the bridge owns it.
  const [pendingTokenAddress, setPendingTokenAddress] = useState<Address | null>(null);

  const effectiveTokenAddress: Address | null = state.bridge?.underlyingTokenAddress ?? pendingTokenAddress;

  const homeL1 = state.homeL1 ?? selectedL1 ?? null;
  const remoteL1 = state.remoteL1 ?? null;
  const isWalletOnHome = Boolean(homeL1 && homeL1.evmChainId === walletChainId);
  const isWalletOnRemote = Boolean(remoteL1 && remoteL1.evmChainId === walletChainId);

  if (!migration.ran) {
    return <BridgeShellSkeleton />;
  }

  // Brand-new user with no bridges and no tentative token — show entry CTA.
  if (!activeBridgeId && !pendingTokenAddress) {
    return (
      <section className="flex flex-col gap-6">
        <BridgeHeader />
        <PhaseStripStaticPreview />
        <EmptyBridgeState onStart={() => setPhase('token')} />
      </section>
    );
  }

  // Pre-bridge state: render a "draft" bridge so the cards & strip have data.
  const draftBridge: Bridge | null = state.bridge
    ? state.bridge
    : pendingTokenAddress && homeL1
      ? {
          id: 'bridge-draft' as Bridge['id'],
          kind: 'erc20-home',
          homeL1Id: homeL1.id,
          homeAddress: '0x0000000000000000000000000000000000000000' as Address,
          underlyingTokenAddress: pendingTokenAddress,
          createdAt: Date.now(),
          remotes: [],
        }
      : null;

  return (
    <section className="flex flex-col gap-6">
      <BridgeHeader />

      <PhaseStrip
        activePhase={phase}
        phaseStatus={state.phaseStatus}
        highestReachablePhase={state.highestReachablePhase}
        onSelect={setPhase}
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_320px] lg:gap-6">
        <div className="flex flex-col gap-4">
          <BridgeGraph
            homeCard={
              <HomeChainCard homeL1={homeL1} bridge={draftBridge} activePhase={phase} isWalletOnHome={isWalletOnHome} />
            }
            rail={<ICMRail events={activityEvents} />}
            remoteHeader={
              <RemoteTabs
                remotes={remotes}
                selectedRemoteId={selectedRemoteId}
                onSelect={(id) => {
                  selectRemote(id);
                  setRemoteId(id);
                }}
                onAddRemote={() => setPhase('remote')}
              />
            }
            remoteCard={
              <RemoteChainCard
                remoteL1={remoteL1}
                remote={state.remote}
                activePhase={phase}
                isWalletOnRemote={isWalletOnRemote}
              />
            }
          />

          <InspectorSlot
            phase={phase}
            bridge={state.bridge}
            remote={state.remote}
            underlyingTokenAddress={effectiveTokenAddress}
            onTokenSelected={setPendingTokenAddress}
            onPhaseChange={setPhase}
            phaseStatus={state.phaseStatus}
          />
        </div>

        <div className="hidden lg:block">
          <ActivityRail events={activityEvents} onClear={clearActivity} />
        </div>
        <div className="lg:hidden">
          <ActivityDrawer events={activityEvents} onClear={clearActivity} />
        </div>
      </div>
    </section>
  );
}

interface InspectorSlotProps {
  phase: BridgePhase;
  bridge: Bridge | null;
  remote: Remote | null;
  underlyingTokenAddress: Address | null;
  onTokenSelected: (a: Address | null) => void;
  onPhaseChange: (next: BridgePhase) => void;
  phaseStatus: ReturnType<typeof useBridgeState> extends infer S
    ? S extends { phaseStatus: infer P }
      ? P
      : never
    : never;
}

function InspectorSlot({
  phase,
  bridge,
  remote,
  underlyingTokenAddress,
  onTokenSelected,
  onPhaseChange,
  phaseStatus,
}: InspectorSlotProps) {
  switch (phase) {
    case 'token':
      return (
        <TokenInspector
          onPhaseChange={onPhaseChange}
          status={phaseStatus.token}
          underlyingTokenAddress={underlyingTokenAddress}
          onTokenSelected={onTokenSelected}
        />
      );
    case 'home':
      return (
        <HomeInspector
          onPhaseChange={onPhaseChange}
          status={phaseStatus.home}
          underlyingTokenAddress={underlyingTokenAddress}
          bridge={bridge}
        />
      );
    case 'remote':
      return (
        <RemoteInspector onPhaseChange={onPhaseChange} status={phaseStatus.remote} bridge={bridge} remote={remote} />
      );
    default:
      return <InspectorComingSoonPlaceholder phase={phase} />;
  }
}

function InspectorComingSoonPlaceholder({ phase }: { phase: BridgePhase }) {
  return (
    <article
      className="rounded-2xl border border-dashed border-zinc-200 bg-zinc-50/50 px-5 py-6 text-sm dark:border-zinc-800 dark:bg-zinc-900/40"
      aria-live="polite"
    >
      <header className="flex items-center justify-between gap-2">
        <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">{PHASE_LABEL[phase]}</h2>
        <span className="rounded-full bg-zinc-200 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200">
          coming soon
        </span>
      </header>
      <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
        Inspector lands in the next PR. Meanwhile, complete this phase in the legacy view.
      </p>
      <Link
        href="/console/ictt/legacy/setup"
        className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-zinc-700 transition-colors hover:text-zinc-900 dark:text-zinc-200 dark:hover:text-white"
      >
        Open legacy setup
        <ArrowRight className="h-3 w-3" aria-hidden />
      </Link>
    </article>
  );
}

interface BridgeGraphProps {
  homeCard: React.ReactNode;
  rail: React.ReactNode;
  remoteHeader: React.ReactNode;
  remoteCard: React.ReactNode;
}

function BridgeGraph({ homeCard, rail, remoteHeader, remoteCard }: BridgeGraphProps) {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] md:items-stretch md:gap-2">
      <div className="md:row-span-2">{homeCard}</div>
      <div className="hidden md:flex md:row-span-2 md:py-2">{rail}</div>
      <div className="flex md:hidden md:row-span-2">{rail}</div>
      <div className="flex flex-col gap-2">
        <div>{remoteHeader}</div>
        <div>{remoteCard}</div>
      </div>
    </div>
  );
}

function EmptyBridgeState({ onStart }: { onStart: () => void }) {
  return (
    <article
      role="status"
      className="flex flex-col gap-3 rounded-2xl border border-dashed border-zinc-300 bg-zinc-50/60 p-8 text-center dark:border-zinc-700 dark:bg-zinc-900/40"
    >
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-100 text-red-600 dark:bg-red-950/40 dark:text-red-400">
        <Sparkles className="h-5 w-5" aria-hidden />
      </div>
      <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">No bridges yet</h2>
      <p className="mx-auto max-w-md text-sm text-zinc-600 dark:text-zinc-400">
        Start by picking a source token, then deploy a TokenHome, mirror it on a destination L1, register the pair, fund
        collateral, and go live. The new flow walks you through it phase-by-phase.
      </p>
      <div className="mt-2 flex flex-wrap items-center justify-center gap-3">
        <button
          type="button"
          onClick={onStart}
          className="inline-flex items-center gap-1.5 rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
        >
          Start a new bridge
          <ArrowRight className="h-3.5 w-3.5" aria-hidden />
        </button>
        <Link
          href="/console/ictt/legacy/setup"
          className="inline-flex items-center gap-1.5 rounded-md border border-zinc-200 bg-white px-4 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
        >
          Use legacy setup
        </Link>
      </div>
    </article>
  );
}

function PhaseStripStaticPreview() {
  return (
    <ol className="flex w-full flex-nowrap items-center gap-1.5 overflow-x-auto pb-1" aria-hidden>
      {BRIDGE_PHASE_ORDER.map((phase, index) => (
        <li key={phase} className="flex shrink-0 items-center gap-1.5">
          <span
            className={cn(
              'inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-sm',
              'border-zinc-200 text-zinc-500 dark:border-zinc-800 dark:text-zinc-400',
            )}
          >
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-zinc-100 text-[10px] font-semibold text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
              {index + 1}
            </span>
            <span className="font-medium">{PHASE_LABEL[phase]}</span>
          </span>
          {index < BRIDGE_PHASE_ORDER.length - 1 && (
            <span aria-hidden className="h-px w-5 bg-zinc-200 dark:bg-zinc-800" />
          )}
        </li>
      ))}
    </ol>
  );
}

function BridgeShellSkeleton() {
  return (
    <section className="flex flex-col gap-6">
      <BridgeHeader />
      <PhaseStripStaticPreview />
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <ChainCardSkeleton role="home" />
        <ChainCardSkeleton role="remote" />
      </div>
    </section>
  );
}
