'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Layers, Plus, Trash2 } from 'lucide-react';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Button } from '@/components/toolbox/components/Button';
import { useIcttBridgeStore } from '@/components/toolbox/stores/iccttBridgeStore';
import { useL1List, type L1ListItem } from '@/components/toolbox/stores/l1ListStore';
import { useBridgeContext } from '../hooks/useBridgeContext';
import { BRIDGE_BASE_PATH } from '../bridge-steps';
import { derivePhaseStatus, highestReachablePhase } from '../utils/derive-status';
import {
  ChainMark,
  ChromeButton,
  Dot,
  ListRow,
  ListRows,
  SHEET_CONTENT,
  SheetBody,
  SheetFoot,
  SheetHead,
  StatusTag,
  type Tone,
} from '../ui';
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
 * Renders as a square hairline `ChromeButton` so it sits on the StepFlow
 * nav row's baseline beside the step counter.
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
  // a confusing empty sheet where the only meaningful action is "New".
  if (!hasBridges) {
    return (
      <ChromeButton
        icon={Plus}
        label="New bridge"
        onClick={handleNewBridge}
        aria-label="Create your first bridge"
        title="Create your first bridge"
      />
    );
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <ChromeButton
          icon={Layers}
          label="Manage bridges"
          badge={count > 99 ? '99+' : count}
          aria-haspopup="dialog"
          aria-label={`Manage bridges, ${count} ${count === 1 ? 'bridge' : 'bridges'}`}
          title="Manage your bridges"
        />
      </SheetTrigger>
      <SheetContent side="right" className={SHEET_CONTENT}>
        <SheetHead eyebrow={`${count} ${count === 1 ? 'bridge' : 'bridges'}`} title="Your bridges" />
        <SheetBody>
          <ListRows>
            {visibleBridges.map((bridge) => {
              const active = ctx.activeBridgeId === bridge.id;
              const homeL1 = l1List.find((l1: L1ListItem) => l1.id === bridge.homeL1Id) ?? null;
              const isIncomplete =
                bridge.remotes.length === 0 || bridge.remotes.every((r) => !r.registeredAt || !r.collateralizedAt);
              return (
                <ListRow
                  key={bridge.id}
                  selected={active}
                  onClick={() => handleSelect(bridge)}
                  trailing={
                    <button
                      type="button"
                      aria-label={`Archive ${homeL1?.name ?? 'bridge'}`}
                      onClick={() => handleArchive(bridge, homeL1?.name ?? 'Unknown chain')}
                      className="-m-1 shrink-0 p-1 text-zinc-400 transition-colors hover:text-[#E6212F] focus-visible:text-[#E6212F] dark:text-zinc-500"
                    >
                      <Trash2 aria-hidden className="h-3.5 w-3.5" />
                    </button>
                  }
                >
                  <BridgeRowLabel bridge={bridge} l1List={l1List} icmHealth={deriveIcmHealth(bridge.id, activityLog)} />
                  {isIncomplete && <StatusTag tone="pending">Incomplete</StatusTag>}
                </ListRow>
              );
            })}
          </ListRows>
        </SheetBody>
        <SheetFoot>
          <Button onClick={handleNewBridge} icon={<Plus aria-hidden className="h-3.5 w-3.5" />} className="w-auto">
            New bridge
          </Button>
        </SheetFoot>
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
    <span className="flex min-w-0 flex-1 items-center gap-3">
      <ChainMark l1={homeL1} size="sm" />
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="flex items-center gap-2">
          <span data-row-title className="truncate text-[13px] font-medium text-zinc-900 dark:text-zinc-50">
            {homeL1?.name ?? 'Unknown chain'} <span className="text-zinc-400">·</span>{' '}
            <span className="font-mono text-[12px]">{tokenLabel}</span>
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

const ICM_HEALTH: Record<IcmHealth, { tone: Tone; title: string; pulse: boolean }> = {
  healthy: { tone: 'ok', title: 'ICM: verified, at least one message delivered', pulse: false },
  'in-flight': { tone: 'pending', title: 'ICM: message in flight', pulse: true },
  unhealthy: { tone: 'error', title: 'ICM: failed delivery, see the bridge log', pulse: false },
  untested: { tone: 'idle', title: 'ICM: no messages yet', pulse: false },
};

function IcmStatusDot({ health }: { health: IcmHealth }) {
  const { tone, title, pulse } = ICM_HEALTH[health];
  return (
    <span aria-label={title} title={title} className="inline-flex">
      <Dot tone={tone} pulse={pulse} />
    </span>
  );
}

/**
 * Renders the bridge's destination chains under the row title. Shows up to
 * 3 remote names inline with their tiny chain avatars; for 4+ remotes the
 * suffix becomes "+N more". Falls back to a muted "No remotes yet" line
 * when the bridge has no destinations registered yet.
 *
 * Chain marks degrade to an initial when the L1 entry
 * doesn't have a `logoUrl` (e.g. user-created L1s without a logo).
 */
function RemoteSummary({ remotes, l1List }: { remotes: Bridge['remotes']; l1List: L1ListItem[] }) {
  if (remotes.length === 0) {
    return <span className="font-mono text-[11px] text-zinc-400 dark:text-zinc-500">No remotes yet</span>;
  }
  const MAX_INLINE = 3;
  const visible = remotes.slice(0, MAX_INLINE);
  const overflow = remotes.length - visible.length;
  return (
    <span className="flex min-w-0 items-center gap-1.5 font-mono text-[11px] text-zinc-500 dark:text-zinc-400">
      <span aria-hidden className="text-zinc-400">
        →
      </span>
      <span className="flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-0.5">
        {visible.map((remote, idx) => {
          const remoteL1 = l1List.find((l1: L1ListItem) => l1.id === remote.l1Id) ?? null;
          return (
            <span key={remote.id} className="flex shrink-0 items-center gap-1">
              <ChainMark l1={remoteL1} size="xs" />
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
