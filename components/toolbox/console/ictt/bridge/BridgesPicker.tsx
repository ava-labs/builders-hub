'use client';

import { useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { Check, ChevronDown, Plus, Trash2 } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useIcttBridgeStore } from '@/components/toolbox/stores/iccttBridgeStore';
import { useL1List, type L1ListItem } from '@/components/toolbox/stores/l1ListStore';
import { cn } from '@/lib/utils';
import { useBridgeContext } from './hooks/useBridgeContext';
import { BRIDGE_BASE_PATH } from './bridge-steps';
import { derivePhaseStatus, highestReachablePhase } from './utils/derive-status';
import type { Bridge } from './types';

/**
 * Top-bar bridge selector. Surfaces every persisted bridge as a labeled menu
 * item so users can hop back to any of them in one click. Sits above the
 * StepFlow strip, replacing the old "TODO(my-bridges)" comment by piggy-
 * backing on the existing `selectBridge` action.
 *
 * Behavior:
 *   - Active bridge is shown in the trigger label
 *   - Selecting a bridge calls `selectBridge(id)` (clears `newBridgeIntent`)
 *     and routes to the highest reachable phase for that bridge so the user
 *     lands somewhere productive instead of always at /token
 *   - "+ New bridge" routes to /token with intent flag set; same effect as
 *     the existing `NewBridgeButton` so the two CTAs stay aligned
 *   - Hidden entirely when the user has no bridges yet — first-time users
 *     don't need a picker for an empty set
 */
export function BridgesPicker() {
  const ctx = useBridgeContext();
  const router = useRouter();
  const bridgesRecord = useIcttBridgeStore((s) => s.bridges);
  const selectBridge = useIcttBridgeStore((s) => s.selectBridge);
  const startNewBridge = useIcttBridgeStore((s) => s.startNewBridge);
  const archiveBridge = useIcttBridgeStore((s) => s.archiveBridge);
  const l1List = useL1List();

  const visibleBridges = useMemo(() => Object.values(bridgesRecord).filter((b) => !b.archivedAt), [bridgesRecord]);

  // First-time users see no picker (no choices to switch between). The
  // NewBridgeButton in the StepFlow nav row covers their "create" path.
  if (visibleBridges.length === 0) return null;

  const activeBridge = ctx.activeBridgeId ? (bridgesRecord[ctx.activeBridgeId] ?? null) : null;

  const handleSelect = (bridge: Bridge) => {
    selectBridge(bridge.id);
    // Derive the highest reachable phase for the picked bridge so the user
    // doesn't land on a phase they've already completed (or skipped over a
    // prerequisite). Uses the bridge's first remote as the implicit context.
    const phaseStatus = derivePhaseStatus({ bridge, remote: bridge.remotes[0] ?? null });
    const phase = highestReachablePhase(phaseStatus);
    router.push(`${BRIDGE_BASE_PATH}/${phase}`);
  };

  const handleNew = () => {
    startNewBridge();
    router.push(`${BRIDGE_BASE_PATH}/token`);
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
    // doesn't keep referring to a now-hidden entry. Picking the first remaining
    // non-archived bridge mirrors the implicit fallback in `useBridgeContext`
    // for `lastActiveBridgeId === null`.
    if (ctx.activeBridgeId === bridge.id) {
      const next = Object.values(bridgesRecord).find((b) => !b.archivedAt && b.id !== bridge.id);
      if (next) selectBridge(next.id);
    }
  };

  return (
    <div
      className={cn(
        'flex w-full items-center gap-2 rounded-xl border border-zinc-200/80 bg-white px-3 py-2 shadow-sm',
        'dark:border-zinc-800 dark:bg-zinc-900',
      )}
    >
      <span className="hidden text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-500 dark:text-zinc-400 sm:inline">
        Bridge
      </span>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className={cn(
              'group inline-flex flex-1 items-center justify-between gap-2 rounded-lg bg-zinc-50 px-2.5 py-1.5 text-left text-xs font-medium text-zinc-700 ring-1 ring-zinc-200/80 transition-colors hover:bg-zinc-100 hover:ring-zinc-300',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400/60',
              'dark:bg-zinc-900/60 dark:text-zinc-200 dark:ring-zinc-700/80 dark:hover:bg-zinc-800/80 dark:hover:ring-zinc-600',
            )}
            aria-label="Switch bridge"
          >
            <span className="flex min-w-0 flex-1 items-center gap-2">
              {activeBridge ? (
                <BridgeRowLabel bridge={activeBridge} l1List={l1List} compact />
              ) : (
                <span className="truncate text-zinc-500">Select a bridge…</span>
              )}
            </span>
            <ChevronDown
              aria-hidden
              className="h-3.5 w-3.5 shrink-0 text-zinc-400 group-hover:text-zinc-700 dark:group-hover:text-zinc-300"
            />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-[min(95vw,360px)]">
          <DropdownMenuLabel className="text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-500">
            Your bridges
          </DropdownMenuLabel>
          {visibleBridges.map((bridge) => {
            const active = ctx.activeBridgeId === bridge.id;
            const homeL1 = l1List.find((l1: L1ListItem) => l1.id === bridge.homeL1Id) ?? null;
            const isIncomplete =
              bridge.remotes.length === 0 || bridge.remotes.every((r) => !r.registeredAt || !r.collateralizedAt);
            return (
              <DropdownMenuItem
                key={bridge.id}
                onSelect={() => handleSelect(bridge)}
                className="group/row flex cursor-pointer items-start gap-2 py-2"
              >
                <span aria-hidden className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center">
                  {active ? <Check className="h-3 w-3 text-emerald-600 dark:text-emerald-400" /> : null}
                </span>
                <BridgeRowLabel bridge={bridge} l1List={l1List} />
                {isIncomplete && (
                  <span className="mt-0.5 inline-flex shrink-0 items-center rounded-full bg-amber-100 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
                    Incomplete
                  </span>
                )}
                <button
                  type="button"
                  aria-label={`Archive ${homeL1?.name ?? 'bridge'}`}
                  onClick={(event) => {
                    // Stop the DropdownMenuItem's `onSelect` from firing — we
                    // want the trash to delete, not select.
                    event.preventDefault();
                    event.stopPropagation();
                    handleArchive(bridge, homeL1?.name ?? 'Unknown chain');
                  }}
                  className="ml-auto mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded text-zinc-400 opacity-0 transition-[opacity,colors] hover:bg-rose-100 hover:text-rose-600 group-hover/row:opacity-100 focus:opacity-100 focus:outline-none focus-visible:ring-1 focus-visible:ring-rose-400 dark:hover:bg-rose-900/40 dark:hover:text-rose-300"
                >
                  <Trash2 aria-hidden className="h-3 w-3" />
                </button>
              </DropdownMenuItem>
            );
          })}
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={handleNew} className="flex cursor-pointer items-center gap-2 py-2 font-medium">
            <Plus aria-hidden className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
            <span>New bridge</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

function BridgeRowLabel({
  bridge,
  l1List,
  compact = false,
}: {
  bridge: Bridge;
  l1List: L1ListItem[];
  compact?: boolean;
}) {
  const homeL1 = l1List.find((l1: L1ListItem) => l1.id === bridge.homeL1Id) ?? null;
  const remoteCount = bridge.remotes.length;
  const tokenLabel = bridge.symbol ?? (bridge.kind === 'native-home' ? 'Native' : 'Untitled token');
  return (
    <span className="flex min-w-0 flex-1 items-center gap-2">
      <HomeAvatar l1={homeL1} compact={compact} />
      <span className="flex min-w-0 flex-1 flex-col leading-tight">
        <span className="truncate text-sm font-medium text-zinc-900 dark:text-zinc-100">
          {homeL1?.name ?? 'Unknown chain'} <span className="text-zinc-400">·</span> {tokenLabel}
        </span>
        {!compact && (
          <span className="text-[11px] text-zinc-500 dark:text-zinc-400">
            {remoteCount === 0 ? 'No remotes yet' : remoteCount === 1 ? '1 remote' : `${remoteCount} remotes`}
          </span>
        )}
      </span>
    </span>
  );
}

function HomeAvatar({ l1, compact }: { l1: L1ListItem | null; compact?: boolean }) {
  const size = compact ? 5 : 6;
  if (!l1?.logoUrl) {
    return (
      <span
        aria-hidden
        className={cn(
          'flex shrink-0 items-center justify-center rounded-md bg-zinc-200 text-[10px] font-semibold uppercase text-zinc-600 dark:bg-zinc-700 dark:text-zinc-300',
          compact ? 'h-5 w-5' : 'h-6 w-6',
        )}
      >
        {l1?.name?.slice(0, 1) ?? '?'}
      </span>
    );
  }
  return (
    <span
      className={cn(
        'relative shrink-0 overflow-hidden rounded-md bg-white ring-1 ring-zinc-200 dark:bg-zinc-900 dark:ring-zinc-700',
        compact ? 'h-5 w-5' : 'h-6 w-6',
      )}
    >
      <Image
        src={l1.logoUrl}
        alt=""
        width={size * 4}
        height={size * 4}
        className="h-full w-full object-contain"
        unoptimized
      />
    </span>
  );
}
