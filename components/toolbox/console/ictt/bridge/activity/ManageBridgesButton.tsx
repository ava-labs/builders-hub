'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { Layers, Plus, Trash2 } from 'lucide-react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { useIcttBridgeStore } from '@/components/toolbox/stores/iccttBridgeStore';
import { useL1List, type L1ListItem } from '@/components/toolbox/stores/l1ListStore';
import { cn } from '@/lib/utils';
import { useBridgeContext } from '../hooks/useBridgeContext';
import { BRIDGE_BASE_PATH } from '../bridge-steps';
import { derivePhaseStatus, highestReachablePhase } from '../utils/derive-status';
import { NavTrailingPill } from './NavTrailingPill';
import type { ActivityEvent, Bridge, BridgeId } from '../types';

/**
 * Single trailing CTA in the StepFlow nav row that consolidates two prior
 * controls:
 *   - the standalone `BridgesPicker` bar that sat above the StepFlow
 *   - the `NewBridgeButton` (refresh icon) reset action
 *
 * Behavior:
 *   - No bridges yet → button reads "+ New bridge"; click goes straight to
 *     `/console/ictt/token` with `newBridgeIntent` set. No empty sheet.
 *   - ≥ 1 bridge → button reads "Manage bridges (N)"; click opens a Sheet
 *     listing every persisted bridge with select / archive affordances and
 *     a "+ New bridge" footer CTA.
 *
 * Visual contract matches the prior `NewBridgeButton` (zinc-50 surface,
 * ring-1 border, h-9 rounded-lg) so it slots into `StepFlow`'s nav row
 * without re-styling the surrounding chrome.
 */
export function ManageBridgesButton() {
  const ctx = useBridgeContext();
  const router = useRouter();
  const bridgesRecord = useIcttBridgeStore((s) => s.bridges);
  const selectBridge = useIcttBridgeStore((s) => s.selectBridge);
  const archiveBridge = useIcttBridgeStore((s) => s.archiveBridge);
  const startNewBridge = useIcttBridgeStore((s) => s.startNewBridge);
  const activityLog = useIcttBridgeStore((s) => s.activityLog);
  const l1List = useL1List();
  const [open, setOpen] = useState(false);

  const visibleBridges = useMemo(() => Object.values(bridgesRecord).filter((b) => !b.archivedAt), [bridgesRecord]);
  const count = visibleBridges.length;
  const hasBridges = count > 0;

  const handleNewBridge = () => {
    startNewBridge();
    setOpen(false);
    router.push(`${BRIDGE_BASE_PATH}/token`);
  };

  const handleSelect = (bridge: Bridge) => {
    selectBridge(bridge.id);
    // Route to the highest reachable phase for the picked bridge so the user
    // doesn't land on a phase they've already completed (or skipped over a
    // prerequisite). Mirrors the prior BridgesPicker behavior.
    const phaseStatus = derivePhaseStatus({ bridge, remote: bridge.remotes[0] ?? null });
    const phase = highestReachablePhase(phaseStatus);
    setOpen(false);
    router.push(`${BRIDGE_BASE_PATH}/${phase}`);
  };

  const handleArchive = (bridge: Bridge, homeName: string) => {
    if (typeof window === 'undefined') return;
    const tokenLabel = bridge.symbol ?? (bridge.kind === 'native-home' ? 'native' : 'untitled');
    const ok = window.confirm(
      `Remove the "${homeName} · ${tokenLabel}" bridge from the console? This won't change anything on-chain.`,
    );
    if (!ok) return;
    archiveBridge(bridge.id);
    // If the active bridge was archived, re-point selection so the BridgeRibbon
    // doesn't keep referring to a hidden entry.
    if (ctx.activeBridgeId === bridge.id) {
      const next = Object.values(bridgesRecord).find((b) => !b.archivedAt && b.id !== bridge.id);
      if (next) selectBridge(next.id);
    }
  };

  // First-time UX: no bridges → button is the create CTA, no sheet. Avoids
  // a confusing empty sheet where the only meaningful action is "+ New".
  if (!hasBridges) {
    return (
      <NavTrailingPill
        icon={Plus}
        iconClassName="text-emerald-600 dark:text-emerald-400"
        label="New bridge"
        focusRingClassName="focus-visible:ring-emerald-400/60"
        onClick={handleNewBridge}
        aria-label="Create your first bridge"
        title="Create your first bridge"
      />
    );
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <NavTrailingPill
          icon={Layers}
          iconClassName="ml-0.5 text-zinc-500 dark:text-zinc-400"
          label="Manage bridges"
          badge={count > 99 ? '99+' : count}
          aria-haspopup="dialog"
          aria-label={`Manage bridges, ${count} ${count === 1 ? 'bridge' : 'bridges'}`}
          title="Manage your bridges"
        />
      </SheetTrigger>
      <SheetContent side="right" className="flex w-full max-w-md flex-col gap-0 p-0 sm:max-w-md">
        <SheetHeader className="border-b border-zinc-100 px-4 py-3 dark:border-zinc-800/80">
          <SheetTitle className="flex items-center gap-2 text-sm font-semibold">
            <Layers aria-hidden className="h-4 w-4" />
            Your bridges
          </SheetTitle>
        </SheetHeader>
        <div className="flex-1 overflow-y-auto px-4 py-3">
          <ul className="flex flex-col gap-2">
            {visibleBridges.map((bridge) => {
              const active = ctx.activeBridgeId === bridge.id;
              const homeL1 = l1List.find((l1: L1ListItem) => l1.id === bridge.homeL1Id) ?? null;
              const isIncomplete =
                bridge.remotes.length === 0 || bridge.remotes.every((r) => !r.registeredAt || !r.collateralizedAt);
              return (
                <li key={bridge.id}>
                  <button
                    type="button"
                    onClick={() => handleSelect(bridge)}
                    aria-pressed={active}
                    className={cn(
                      'group/row flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left transition-colors',
                      active
                        ? 'bg-emerald-50 ring-1 ring-emerald-200 dark:bg-emerald-950/20 dark:ring-emerald-900/60'
                        : 'hover:bg-zinc-100/70 dark:hover:bg-zinc-800/40',
                    )}
                  >
                    <BridgeRowLabel
                      bridge={bridge}
                      l1List={l1List}
                      icmHealth={deriveIcmHealth(bridge.id, activityLog)}
                    />
                    {isIncomplete && (
                      <span className="inline-flex shrink-0 items-center rounded-full bg-amber-100 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
                        Incomplete
                      </span>
                    )}
                    <span
                      role="button"
                      tabIndex={0}
                      aria-label={`Archive ${homeL1?.name ?? 'bridge'}`}
                      onClick={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        handleArchive(bridge, homeL1?.name ?? 'Unknown chain');
                      }}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault();
                          event.stopPropagation();
                          handleArchive(bridge, homeL1?.name ?? 'Unknown chain');
                        }
                      }}
                      className="inline-flex h-5 w-5 shrink-0 cursor-pointer items-center justify-center rounded text-zinc-400 opacity-0 transition-[opacity,colors] hover:bg-rose-100 hover:text-rose-600 group-hover/row:opacity-100 focus:opacity-100 focus:outline-none focus-visible:ring-1 focus-visible:ring-rose-400 dark:hover:bg-rose-900/40 dark:hover:text-rose-300"
                    >
                      <Trash2 aria-hidden className="h-3 w-3" />
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
        <footer className="border-t border-zinc-100 px-4 py-3 dark:border-zinc-800/80">
          <button
            type="button"
            onClick={handleNewBridge}
            className={cn(
              'inline-flex w-full items-center justify-center gap-1.5 rounded-md bg-emerald-600 px-3 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-emerald-500',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/60',
            )}
          >
            <Plus aria-hidden className="h-3.5 w-3.5" />
            New bridge
          </button>
        </footer>
      </SheetContent>
    </Sheet>
  );
}

/**
 * Sheet row label: home L1 avatar + chain name · token symbol + remote count.
 * Lifted from the deleted `BridgesPicker` so we don't lose the design.
 */
function BridgeRowLabel({ bridge, l1List, icmHealth }: { bridge: Bridge; l1List: L1ListItem[]; icmHealth: IcmHealth }) {
  const homeL1 = l1List.find((l1: L1ListItem) => l1.id === bridge.homeL1Id) ?? null;
  const tokenLabel = bridge.symbol ?? (bridge.kind === 'native-home' ? 'Native' : 'Untitled token');
  return (
    <span className="flex min-w-0 flex-1 items-center gap-2">
      <HomeAvatar l1={homeL1} />
      <span className="flex min-w-0 flex-1 flex-col leading-tight">
        <span className="flex items-center gap-1.5">
          <span className="truncate text-sm font-medium text-zinc-900 dark:text-zinc-100">
            {homeL1?.name ?? 'Unknown chain'} <span className="text-zinc-400">·</span> {tokenLabel}
          </span>
          <IcmStatusDot health={icmHealth} />
        </span>
        <RemoteSummary remotes={bridge.remotes} l1List={l1List} />
      </span>
    </span>
  );
}

/**
 * Per-bridge ICM relayer health, derived from the activity log alone:
 *  - `unhealthy`  any `failed` event recorded for this bridge
 *  - `in-flight`  any `pending` row, or any `confirmed` send/register-sent
 *                 still missing its paired destination event
 *  - `healthy`    at least one `delivered` row and no in-flight/failed
 *  - `untested`   no events recorded
 *
 * Zero new fetches — `useDeliveryWatcher` already promotes rows to
 * `delivered` as Teleporter's `ReceiveCrossChainMessage` is observed.
 */
type IcmHealth = 'healthy' | 'in-flight' | 'unhealthy' | 'untested';

function deriveIcmHealth(bridgeId: BridgeId, log: ActivityEvent[]): IcmHealth {
  let hasFailed = false;
  let hasPending = false;
  let hasDelivered = false;
  for (const event of log) {
    if (event.bridgeId !== bridgeId) continue;
    if (event.status === 'failed') {
      hasFailed = true;
      continue;
    }
    if (event.status === 'pending') {
      hasPending = true;
      continue;
    }
    if (event.status === 'delivered') {
      hasDelivered = true;
      continue;
    }
    // `confirmed` on a cross-chain source row without a paired delivery = in flight.
    if (
      event.status === 'confirmed' &&
      (event.kind === 'send' || event.kind === 'register-sent') &&
      !event.pairedWith
    ) {
      hasPending = true;
    }
  }
  if (hasFailed) return 'unhealthy';
  if (hasPending) return 'in-flight';
  if (hasDelivered) return 'healthy';
  return 'untested';
}

function IcmStatusDot({ health }: { health: IcmHealth }) {
  const config: Record<IcmHealth, { className: string; title: string; pulse: boolean }> = {
    healthy: {
      className: 'bg-emerald-500',
      title: 'ICM: verified — at least one message delivered',
      pulse: false,
    },
    'in-flight': {
      className: 'bg-amber-400',
      title: 'ICM: message in flight',
      pulse: true,
    },
    unhealthy: {
      className: 'bg-rose-500',
      title: 'ICM: failed delivery — see activity log',
      pulse: false,
    },
    untested: {
      className: 'bg-zinc-300 dark:bg-zinc-600',
      title: 'ICM: no messages yet',
      pulse: false,
    },
  };
  const { className, title, pulse } = config[health];
  return (
    <span aria-label={title} title={title} className="relative inline-flex h-1.5 w-1.5 shrink-0">
      {pulse && (
        <span
          aria-hidden
          className={cn('absolute inline-flex h-full w-full animate-ping rounded-full opacity-75', className)}
        />
      )}
      <span aria-hidden className={cn('relative inline-flex h-1.5 w-1.5 rounded-full', className)} />
    </span>
  );
}

/**
 * Renders the bridge's destination chains under the row title. Shows up to
 * 3 remote names inline with their tiny chain avatars; for 4+ remotes the
 * suffix becomes "+N more". Falls back to a muted "No remotes yet" line
 * when the bridge has no destinations registered yet.
 *
 * Avatars degrade gracefully via {@link RemoteAvatar} when the L1 entry
 * doesn't have a `logoUrl` (e.g. user-created L1s without a logo).
 */
function RemoteSummary({ remotes, l1List }: { remotes: Bridge['remotes']; l1List: L1ListItem[] }) {
  if (remotes.length === 0) {
    return <span className="text-[11px] text-zinc-500 dark:text-zinc-400">No remotes yet</span>;
  }
  const MAX_INLINE = 3;
  const visible = remotes.slice(0, MAX_INLINE);
  const overflow = remotes.length - visible.length;
  return (
    <span className="flex min-w-0 items-center gap-1 text-[11px] text-zinc-500 dark:text-zinc-400">
      <span aria-hidden className="text-zinc-400">
        →
      </span>
      <span className="flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-0.5">
        {visible.map((remote, idx) => {
          const remoteL1 = l1List.find((l1: L1ListItem) => l1.id === remote.l1Id) ?? null;
          return (
            <span key={remote.id} className="flex shrink-0 items-center gap-1">
              <RemoteAvatar l1={remoteL1} />
              <span className="truncate text-zinc-600 dark:text-zinc-300">{remoteL1?.name ?? 'Unknown'}</span>
              {idx < visible.length - 1 && <span className="text-zinc-400">·</span>}
            </span>
          );
        })}
        {overflow > 0 && <span className="shrink-0 text-zinc-400">+{overflow} more</span>}
      </span>
    </span>
  );
}

function HomeAvatar({ l1 }: { l1: L1ListItem | null }) {
  if (!l1?.logoUrl) {
    return (
      <span
        aria-hidden
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-zinc-200 text-[10px] font-semibold uppercase text-zinc-600 dark:bg-zinc-700 dark:text-zinc-300"
      >
        {l1?.name?.slice(0, 1) ?? '?'}
      </span>
    );
  }
  return (
    <span className="relative h-7 w-7 shrink-0 overflow-hidden rounded-md bg-white ring-1 ring-zinc-200 dark:bg-zinc-900 dark:ring-zinc-700">
      <Image src={l1.logoUrl} alt="" width={28} height={28} className="h-7 w-7 object-contain" unoptimized />
    </span>
  );
}

function RemoteAvatar({ l1 }: { l1: L1ListItem | null }) {
  if (!l1?.logoUrl) {
    return (
      <span
        aria-hidden
        className="flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-sm bg-zinc-200 text-[8px] font-semibold uppercase text-zinc-600 dark:bg-zinc-700 dark:text-zinc-300"
      >
        {l1?.name?.slice(0, 1) ?? '?'}
      </span>
    );
  }
  return (
    <span className="relative h-3.5 w-3.5 shrink-0 overflow-hidden rounded-sm bg-white ring-1 ring-zinc-200 dark:bg-zinc-900 dark:ring-zinc-700">
      <Image src={l1.logoUrl} alt="" width={14} height={14} className="h-3.5 w-3.5 object-contain" unoptimized />
    </span>
  );
}
