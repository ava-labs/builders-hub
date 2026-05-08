'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowLeftRight } from 'lucide-react';
import { useWalletStore } from '@/components/toolbox/stores/walletStore';
import { useWalletSwitch } from '@/components/toolbox/hooks/useWalletSwitch';
import { useL1List } from '@/components/toolbox/stores/l1ListStore';
import { ConnectedWalletProvider } from '@/components/toolbox/contexts/ConnectedWalletContext';
import { Note } from '@/components/toolbox/components/Note';
import { useBridgeState } from './use-bridge-state';
import { useBridgeActivity } from './use-bridge-activity';
import { useHomeTokenSnapshot, useRemoteTokenSnapshot } from './use-token-snapshot';
import { TokenSnapshotPanel } from './token-snapshot';
import { PhaseStrip } from './phase-strip';
import { RemotePicker } from './remote-picker';
import { ResetBridgeButton } from './reset-bridge-button';
import { ShortcutsOverlay } from './shortcuts-overlay';
import { ChainPanel } from './chain-panel';
import { ICMConnection } from './icm-connection';
import { ActivityFeed } from './activity-feed';
import { WalletPill } from './wallet-pill';
import { TokenInspector } from './inspectors/token-inspector';
import { HomeInspector } from './inspectors/home-inspector';
import { RemoteInspector } from './inspectors/remote-inspector';
import { RegisterInspector } from './inspectors/register-inspector';
import { CollateralInspector } from './inspectors/collateral-inspector';
import { TransferInspector } from './inspectors/transfer-inspector';
import { PHASES, type PhaseId } from './types';
import type { ActivityEvent } from './types';

const ACCENT = '#3B82F6';

const PHASE_TO_NEXT: Record<PhaseId, PhaseId | null> = {
  token: 'home',
  home: 'remote',
  remote: 'register',
  register: 'collateral',
  collateral: 'transfer',
  transfer: null,
};

/**
 * Top-level shell for the ICTT Bridge Console. Replaces the 7-route
 * wizard with a single spatial page: home chain on the left, ICM rail
 * in the middle, remote chain on the right; a phase strip across the
 * top, an inspector pane on the bottom-left, and an activity feed on
 * the bottom-right.
 *
 * Phase state is local — no per-phase URL routing. Optional `?phase=…`
 * search-param deep-link is supported for the redirect targets coming
 * from the old `/setup/[step]` and `/token-transfer/[step]` routes.
 */
const PREFERRED_REMOTE_STORAGE_KEY = 'ictt-bridge-preferred-remote-v1';

/** Persist the preferred remote per home chain in localStorage so the
 *  user's last selection survives a reload even without a URL param.
 *  Keyed by home chain ID since the same wallet might run bridges from
 *  multiple home chains. */
function loadPreferredRemote(homeChainId: string | undefined): string | undefined {
  if (!homeChainId || typeof window === 'undefined') return undefined;
  try {
    const raw = window.localStorage.getItem(PREFERRED_REMOTE_STORAGE_KEY);
    if (!raw) return undefined;
    const map = JSON.parse(raw) as Record<string, string>;
    return map[homeChainId];
  } catch {
    return undefined;
  }
}

function savePreferredRemote(homeChainId: string, remoteChainId: string | undefined) {
  if (typeof window === 'undefined') return;
  try {
    const raw = window.localStorage.getItem(PREFERRED_REMOTE_STORAGE_KEY);
    const map: Record<string, string> = raw ? JSON.parse(raw) : {};
    if (remoteChainId) {
      map[homeChainId] = remoteChainId;
    } else {
      delete map[homeChainId];
    }
    window.localStorage.setItem(PREFERRED_REMOTE_STORAGE_KEY, JSON.stringify(map));
  } catch {
    /* quota / disabled storage — silent */
  }
}

export function BridgeConsole({
  initialPhase,
  initialRemoteChainId,
}: {
  initialPhase?: PhaseId;
  initialRemoteChainId?: string;
}) {
  const [preferredRemoteChainId, setPreferredRemoteChainId] = useState<string | undefined>(initialRemoteChainId);
  const bridge = useBridgeState({ preferredRemoteChainId });

  // Hydrate from localStorage on first mount (after we know the home
  // chain). URL `?remote=` always wins over persisted state.
  useEffect(() => {
    if (preferredRemoteChainId || !bridge.homeChain?.id) return;
    const stored = loadPreferredRemote(bridge.homeChain.id);
    if (stored && bridge.allRemotes.some((r) => r.chain.id === stored)) {
      setPreferredRemoteChainId(stored);
    }
    // We intentionally only run this once per home chain change — if the
    // user clears their selection, the auto-pick kicks in.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bridge.homeChain?.id]);

  // Persist any explicit selection. Skipping when no home chain (during
  // bootstrap) avoids writing under an empty key.
  useEffect(() => {
    if (!bridge.homeChain?.id) return;
    savePreferredRemote(bridge.homeChain.id, preferredRemoteChainId);
  }, [bridge.homeChain?.id, preferredRemoteChainId]);
  const { events, append, clear: clearActivity, messageCount } = useBridgeActivity();
  const homeSnapshot = useHomeTokenSnapshot({
    homeChain: bridge.homeChain,
    homeAddress: bridge.homeAddress,
    homeKind: bridge.homeKind,
    remoteChainId: bridge.remoteChain?.id,
  });
  const remoteSnapshot = useRemoteTokenSnapshot({
    remoteChain: bridge.remoteChain,
    remoteAddress: bridge.remoteAddress,
  });
  const walletEVMAddress = useWalletStore((s) => s.walletEVMAddress);
  const walletChainId = useWalletStore((s) => s.walletChainId);
  const { safelySwitch } = useWalletSwitch();
  const l1List = useL1List();

  // Resolves an explorer transaction URL from an event's chainId by
  // matching against `L1ListItem.evmChainId`. Returns null when the chain
  // isn't recognized or doesn't have an explorerUrl configured.
  const getEventExplorerUrl = (event: ActivityEvent) => {
    if (!event.txHash) return null;
    const chain = l1List.find((l1: { evmChainId: number; explorerUrl?: string }) => l1.evmChainId === event.chainId);
    if (!chain?.explorerUrl) return null;
    return `${chain.explorerUrl.replace(/\/+$/, '')}/tx/${event.txHash}`;
  };

  // Compute the first non-blocked, non-done phase as the default. Falls
  // back to `transfer` (the live phase) when the bridge is fully set up.
  const computedActive = useMemo<PhaseId>(() => {
    if (initialPhase && bridge.phaseStatus[initialPhase] !== 'blocked') return initialPhase;
    for (const p of PHASES) {
      const s = bridge.phaseStatus[p.id];
      if (s !== 'done' && s !== 'blocked') return p.id;
    }
    return 'transfer';
  }, [initialPhase, bridge.phaseStatus]);

  const [activePhase, setActivePhase] = useState<PhaseId>(computedActive);
  const [switching, setSwitching] = useState(false);

  // Keep the address bar in sync with active phase + selected remote so
  // the URL is always shareable. Uses `history.replaceState` rather than
  // Next.js `router.replace` to avoid a server round-trip on every click.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const url = new URL(window.location.href);
    url.searchParams.set('phase', activePhase);
    if (preferredRemoteChainId) {
      url.searchParams.set('remote', preferredRemoteChainId);
    } else {
      url.searchParams.delete('remote');
    }
    const next = `${url.pathname}?${url.searchParams.toString()}`;
    if (next !== `${window.location.pathname}${window.location.search}`) {
      window.history.replaceState({}, '', next);
    }
  }, [activePhase, preferredRemoteChainId]);

  // If the active phase becomes blocked (shouldn't happen normally, but
  // can happen if state is rebuilt after a chain switch), fall back to
  // the computed default phase.
  useEffect(() => {
    if (bridge.phaseStatus[activePhase] === 'blocked') {
      setActivePhase(computedActive);
    }
  }, [activePhase, bridge.phaseStatus, computedActive]);

  // Smart auto-advance: when the active phase flips to `done` via
  // background polling (e.g., the register phase confirms registration
  // ~30s after the ICM message lands), auto-advance the user to the
  // next non-blocked phase. Without this, users would stare at a "done"
  // inspector and have to click "Continue" to move forward.
  useEffect(() => {
    if (bridge.phaseStatus[activePhase] !== 'done') return;
    const next = PHASE_TO_NEXT[activePhase];
    if (next && bridge.phaseStatus[next] !== 'blocked' && bridge.phaseStatus[next] !== 'done') {
      setActivePhase(next);
    }
  }, [activePhase, bridge.phaseStatus]);

  // Arrow-key phase navigation. Skips blocked phases so users can
  // hold ← / → to scrub through what's actually reachable. Ignored when
  // the focus is in an editable field so typed text isn't hijacked.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
        return;
      }
      const direction = e.key === 'ArrowLeft' ? -1 : 1;
      const currentIndex = PHASES.findIndex((p) => p.id === activePhase);
      if (currentIndex === -1) return;
      // Walk in the chosen direction skipping blocked phases.
      for (let i = currentIndex + direction; i >= 0 && i < PHASES.length; i += direction) {
        const next = PHASES[i];
        if (bridge.phaseStatus[next.id] !== 'blocked') {
          e.preventDefault();
          setActivePhase(next.id);
          return;
        }
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [activePhase, bridge.phaseStatus]);

  const handleSwitchChain = async (chainId: number, isTestnet: boolean) => {
    setSwitching(true);
    try {
      await safelySwitch(chainId, isTestnet);
    } finally {
      setSwitching(false);
    }
  };

  const handleAdvance = () => {
    const next = PHASE_TO_NEXT[activePhase];
    if (next && bridge.phaseStatus[next] !== 'blocked') {
      setActivePhase(next);
    }
  };

  const appendActivity = (e: Omit<ActivityEvent, 'id' | 'timestamp'>) => append(e);

  // Choose what to render in the bottom-left inspector slot.
  const renderInspector = () => {
    const common = {
      bridge,
      accent: ACCENT,
      onAdvance: handleAdvance,
      appendActivity,
      switchChain: handleSwitchChain,
    };
    switch (activePhase) {
      case 'token':
        return <TokenInspector {...common} />;
      case 'home':
        return <HomeInspector {...common} />;
      case 'remote':
        return <RemoteInspector {...common} />;
      case 'register':
        return <RegisterInspector {...common} />;
      case 'collateral':
        return <CollateralInspector {...common} />;
      case 'transfer':
        return <TransferInspector {...common} />;
    }
  };

  const subtitle = (() => {
    const homeName = bridge.homeChain?.name ?? '—';
    const remoteName = bridge.remoteChain?.name ?? '—';
    const tokenLabel = bridge.tokenAddress ? 'TOKEN' : '—';
    return `${tokenLabel} · ${homeName} ↔ ${remoteName} · setup ${bridge.progress}% complete`;
  })();

  // Expected chain for the wallet pill = source-chain for the active
  // phase. Token / home / collateral need home; remote / register need
  // remote; transfer needs source side based on direction (default home).
  const expectedChain = (() => {
    if (activePhase === 'remote' || activePhase === 'register') return bridge.remoteChain;
    return bridge.homeChain;
  })();

  const isWalletConnected = !!walletEVMAddress;
  const homeWalletConnected =
    isWalletConnected && bridge.homeChain ? walletChainId === bridge.homeChain.evmChainId : false;
  const remoteWalletConnected =
    isWalletConnected && bridge.remoteChain ? walletChainId === bridge.remoteChain.evmChainId : false;

  const icmActive = activePhase === 'register' || activePhase === 'transfer';

  const dimLeft = activePhase === 'remote' || activePhase === 'register';
  const dimRight = activePhase === 'token' || activePhase === 'home' || activePhase === 'collateral';

  return (
    <div className="w-full h-full flex flex-col font-sans bg-zinc-50 dark:bg-zinc-950">
      {/* Sticky header group: top bar + phase strip stick together so the
          phase navigation stays reachable when the user scrolls long
          inspector content (especially on tablet). The `top-12` offset
          clears the console layout's 3rem-tall header. */}
      <div className="sticky top-12 z-20 flex-shrink-0">
        {/* Top bar */}
        <div className="border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 px-4 md:px-6 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-7 h-7 rounded-lg grid place-items-center flex-shrink-0" style={{ background: ACCENT }}>
              <ArrowLeftRight className="w-4 h-4 text-white" strokeWidth={2.5} />
            </div>
            <div className="min-w-0">
              <div className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">ICTT Bridge Console</div>
              <div className="text-[10px] text-zinc-500 dark:text-zinc-400 truncate">{subtitle}</div>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <Link
              href="/console/history"
              className="hidden md:inline-flex items-center px-3 py-1.5 text-xs font-medium text-zinc-600 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-900"
            >
              History
            </Link>
            <ResetBridgeButton
              homeChainId={bridge.homeChain?.id}
              remoteChainIds={bridge.allRemotes.map((r) => r.chain.id)}
              hasAnythingToReset={!!(bridge.tokenAddress || bridge.homeAddress || bridge.allRemotes.length > 0)}
              onAfterReset={() => {
                clearActivity();
                setPreferredRemoteChainId(undefined);
                setActivePhase('token');
              }}
            />
            <ShortcutsOverlay />
            <WalletPill
              walletAddress={walletEVMAddress}
              walletChainId={walletChainId}
              expectedChain={expectedChain}
              onSwitchChain={
                expectedChain ? () => handleSwitchChain(expectedChain.evmChainId, !!expectedChain.isTestnet) : undefined
              }
            />
          </div>
        </div>

        {/* Phase strip */}
        <PhaseStrip
          activePhase={activePhase}
          phaseStatus={bridge.phaseStatus}
          onPhaseClick={(p) => setActivePhase(p)}
          accent={ACCENT}
        />
      </div>

      {/* Empty state when wallet is disconnected */}
      {!isWalletConnected && (
        <div className="flex-1 grid place-items-center px-6 py-10">
          <div className="max-w-md text-center">
            <div className="w-12 h-12 rounded-2xl mx-auto mb-4 grid place-items-center" style={{ background: ACCENT }}>
              <ArrowLeftRight className="w-6 h-6 text-white" strokeWidth={2.5} />
            </div>
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 mb-2">
              Connect a wallet to start a bridge
            </h2>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              The bridge console deploys TokenHome on a source chain, TokenRemote on a destination chain, and pairs
              them via ICM so tokens can move both ways.
            </p>
          </div>
        </div>
      )}

      {isWalletConnected && (
        <ConnectedWalletProvider>
          {/* Main two-pane layout: stacks vertically below `lg` (≥1024px). */}
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_8rem_1fr] gap-3 px-4 md:px-5 pt-4 pb-2 flex-shrink-0">
            <ChainPanel
              chain={bridge.homeChain}
              role="HOME · ORIGIN"
              contracts={bridge.homeContracts}
              dim={dimLeft}
              walletConnected={homeWalletConnected}
              expandedDetails={
                <>
                  {bridge.homeAddress && (
                    <TokenSnapshotPanel title="Token snapshot" snapshot={homeSnapshot} />
                  )}
                  <CollateralProgressDetail
                    registered={bridge.registered}
                    collateralNeeded={bridge.collateralNeeded.toString()}
                    accent={ACCENT}
                  />
                </>
              }
              initiallyExpanded={activePhase === 'transfer'}
            />

            <div className="hidden lg:block">
              <ICMConnection accent={ACCENT} active={icmActive} count={messageCount} orientation="vertical" />
            </div>

            <div className="lg:hidden">
              <ICMConnection accent={ACCENT} active={icmActive} count={messageCount} orientation="horizontal" />
            </div>

            <ChainPanel
              chain={bridge.remoteChain}
              role="REMOTE · DESTINATION"
              contracts={bridge.remoteContracts}
              dim={dimRight}
              walletConnected={remoteWalletConnected}
              headerExtra={
                bridge.allRemotes.length > 1 && bridge.remoteChain ? (
                  <RemotePicker
                    remotes={bridge.allRemotes}
                    selected={bridge.remoteChain}
                    onChange={setPreferredRemoteChainId}
                  />
                ) : null
              }
              expandedDetails={
                <>
                  {bridge.remoteAddress && (
                    <TokenSnapshotPanel
                      title="Wrapped supply"
                      snapshot={remoteSnapshot}
                      showBridged={false}
                    />
                  )}
                  <PairingStatusDetail registered={bridge.registered} lastChecked={bridge.lastChecked} />
                </>
              }
              initiallyExpanded={activePhase === 'transfer'}
            />
          </div>

          {/* Bottom split: Inspector + Activity feed */}
          <div className="flex-1 grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-3 px-4 md:px-5 pb-5 min-h-0">
            <div className="min-h-[16rem] flex">
              <div className="flex-1 flex">{renderInspector()}</div>
            </div>
            <div className="min-h-[16rem] flex">
              <div className="flex-1 flex">
                <ActivityFeed
                  events={events}
                  getExplorerUrl={getEventExplorerUrl}
                  accent={ACCENT}
                  onStart={
                    bridge.tokenAddress
                      ? undefined
                      : () => setActivePhase('token')
                  }
                />
              </div>
            </div>
          </div>

          {/* Switching indicator */}
          {switching && (
            <div className="absolute bottom-4 right-4 z-50">
              <Note variant="default">Switching wallet network…</Note>
            </div>
          )}
        </ConnectedWalletProvider>
      )}
    </div>
  );
}

function CollateralProgressDetail({
  registered,
  collateralNeeded,
  accent,
}: {
  registered: boolean;
  collateralNeeded: string;
  accent: string;
}) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-zinc-400 dark:text-zinc-500 font-semibold mb-2">
        Collateral
      </div>
      <div className="rounded-xl border border-dashed border-zinc-300 dark:border-zinc-700 p-3 bg-zinc-50/50 dark:bg-zinc-900/30">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-zinc-600 dark:text-zinc-400">
            {registered ? 'Status' : 'Awaiting registration'}
          </span>
          <span className="text-xs font-mono text-zinc-900 dark:text-zinc-100">
            {registered ? `${collateralNeeded === '0' ? '✓ funded' : `needs ${collateralNeeded}`}` : '—'}
          </span>
        </div>
        <div className="h-1.5 bg-zinc-200 dark:bg-zinc-800 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all"
            style={{ width: registered && collateralNeeded === '0' ? '100%' : '0%', background: accent }}
          />
        </div>
      </div>
    </div>
  );
}

function PairingStatusDetail({ registered, lastChecked }: { registered: boolean; lastChecked: number | null }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-zinc-400 dark:text-zinc-500 font-semibold mb-2">
        Pairing status
      </div>
      <div
        className={`rounded-xl border p-3 ${
          registered
            ? 'border-emerald-200 bg-emerald-50/50 dark:border-emerald-900/60 dark:bg-emerald-950/20'
            : 'border-amber-200 bg-amber-50/60 dark:border-amber-900/60 dark:bg-amber-950/30'
        }`}
      >
        <div className="flex items-center gap-2 mb-1">
          <span
            className={`w-1.5 h-1.5 rounded-full ${
              registered ? 'bg-emerald-500' : 'bg-amber-500 animate-pulse'
            }`}
          />
          <span
            className={`text-xs font-medium ${
              registered ? 'text-emerald-800 dark:text-emerald-300' : 'text-amber-800 dark:text-amber-300'
            }`}
          >
            {registered ? 'Paired with Home' : 'Awaiting Home acknowledgement'}
          </span>
        </div>
        {lastChecked && (
          <p
            className={`text-[11px] leading-relaxed ${
              registered ? 'text-emerald-700/80 dark:text-emerald-400/80' : 'text-amber-700/80 dark:text-amber-400/80'
            }`}
          >
            Last polled {Math.max(0, Math.floor((Date.now() - lastChecked) / 1000))}s ago.
          </p>
        )}
      </div>
    </div>
  );
}
