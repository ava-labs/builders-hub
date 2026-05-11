'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { ArrowRight, ChevronRight, Layers, MessageSquare, Plus } from 'lucide-react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { useIcttBridgeStore } from '@/components/toolbox/stores/iccttBridgeStore';
import { useL1List, type L1ListItem } from '@/components/toolbox/stores/l1ListStore';
import { cn } from '@/lib/utils';
import { useBridgeContext } from './hooks/useBridgeContext';
import { HomeChainCard } from './HomeChainCard';
import { RemoteChainCard } from './RemoteChainCard';
import { truncateAddress } from './utils/explorer-url';
import { formatRelativeTime } from './utils/relative-time';
import { BRIDGE_BASE_PATH } from './bridge-steps';
import type { ActivityEvent, Address } from './types';

const RECENT_WINDOW_MS = 60 * 60 * 1000;

/**
 * Compact summary of the bridge identity (Home → ICM → Remote).
 * Replaces the previous floor-eating ChainCardsRow. Each side opens the full
 * chain-card detail in a Sheet so users can still inspect addresses, rows
 * and connection state.
 */
export function BridgeRibbon() {
  const ctx = useBridgeContext();
  const router = useRouter();
  const allActivity = useIcttBridgeStore((s) => s.activityLog);
  const icmEvents = useMemo(() => {
    const now = Date.now();
    return allActivity
      .filter((e) => {
        if (ctx.activeBridgeId && e.bridgeId !== ctx.activeBridgeId) return false;
        if (e.kind !== 'icm' && !e.icmMessageId) return false;
        return now - e.timestampMs <= RECENT_WINDOW_MS;
      })
      .sort((a, b) => b.timestampMs - a.timestampMs);
  }, [allActivity, ctx.activeBridgeId]);

  return (
    <div
      className={cn(
        'flex w-full flex-col gap-2 rounded-2xl border border-zinc-200/80 bg-white px-3 py-2 shadow-sm',
        'md:flex-row md:items-stretch md:gap-3 md:px-2 md:py-2',
        'dark:border-zinc-800 dark:bg-zinc-900',
      )}
    >
      <HomeSide />
      <Divider />
      <ICMPill events={icmEvents} />
      <Divider />
      <RemoteSide />
    </div>
  );

  function HomeSide() {
    return (
      <RibbonSide
        role="home"
        l1={ctx.homeL1 ?? null}
        deployed={Boolean(ctx.bridge?.homeAddress)}
        deployedAddress={ctx.bridge?.homeAddress ?? null}
        deployedLabel="TokenHome"
        emptyLabel="Setup pending"
        sheetTitle={ctx.homeL1 ? `${ctx.homeL1.name} · Home` : 'Home chain'}
        sheetBody={
          <HomeChainCard
            homeL1={ctx.homeL1 ?? null}
            bridge={ctx.bridge}
            activePhase={ctx.phase}
            isWalletOnHome={ctx.isWalletOnHome}
          />
        }
      />
    );
  }

  function RemoteSide() {
    if (ctx.remote) {
      return (
        <RibbonSide
          role="remote"
          l1={ctx.remoteL1 ?? null}
          deployed={Boolean(ctx.remote.address)}
          deployedAddress={ctx.remote.address}
          deployedLabel="TokenRemote"
          emptyLabel="Pending"
          sheetTitle={ctx.remoteL1 ? `${ctx.remoteL1.name} · Remote` : 'Remote chain'}
          sheetBody={
            <RemoteChainCard
              remoteL1={ctx.remoteL1 ?? null}
              remote={ctx.remote}
              activePhase={ctx.phase}
              isWalletOnRemote={ctx.isWalletOnRemote}
            />
          }
        />
      );
    }
    // Block ribbon-driven picking until TokenHome is deployed — otherwise users
    // can jump to Phase 3 without prerequisites.
    if (!ctx.bridge?.homeAddress) {
      return (
        <div
          className={cn(
            'flex flex-1 cursor-not-allowed items-center gap-2 rounded-xl border border-dashed border-zinc-200 bg-zinc-50/40 px-3 py-2 text-left opacity-70',
            'dark:border-zinc-800 dark:bg-zinc-900/40',
          )}
          aria-label="Pick destination chain (disabled — deploy TokenHome first)"
        >
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-zinc-100 text-zinc-400 dark:bg-zinc-800 dark:text-zinc-500">
            <Plus className="h-3.5 w-3.5" aria-hidden />
          </span>
          <div className="flex flex-1 flex-col">
            <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-400">
              Remote · Destination
            </span>
            <span className="text-sm font-medium text-zinc-500 dark:text-zinc-400">Deploy TokenHome first</span>
          </div>
        </div>
      );
    }
    return (
      <PickDestinationSheet
        homeL1Id={ctx.homeL1?.id ?? null}
        pendingL1Id={ctx.pendingDestinationL1Id}
        onConfirm={(l1Id) => {
          ctx.setPendingDestinationL1Id(l1Id);
          router.push(`${BRIDGE_BASE_PATH}/remote?destination=${encodeURIComponent(l1Id)}`);
        }}
      />
    );
  }
}

interface RibbonSideProps {
  role: 'home' | 'remote';
  l1: L1ListItem | null;
  deployed: boolean;
  deployedAddress: Address | null;
  deployedLabel: string;
  emptyLabel: string;
  sheetTitle: string;
  sheetBody: ReactNode;
}

function RibbonSide({
  role,
  l1,
  deployed,
  deployedAddress,
  deployedLabel,
  emptyLabel,
  sheetTitle,
  sheetBody,
}: RibbonSideProps) {
  const [open, setOpen] = useState(false);
  const eyebrow = role === 'home' ? 'Home · Origin' : 'Remote · Destination';
  const eyebrowTone = role === 'home' ? 'text-red-600 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400';
  const hoverTone =
    role === 'home'
      ? 'hover:border-red-200 hover:bg-red-50/40 dark:hover:border-red-900/60 dark:hover:bg-red-950/20'
      : 'hover:border-emerald-200 hover:bg-emerald-50/40 dark:hover:border-emerald-900/60 dark:hover:bg-emerald-950/20';

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <button
          type="button"
          aria-haspopup="dialog"
          aria-label={`${role === 'home' ? 'Home' : 'Remote'} chain details`}
          className={cn(
            'group/side flex flex-1 items-center gap-2.5 rounded-xl border border-transparent px-3 py-2 text-left transition-colors',
            hoverTone,
          )}
        >
          <ChainAvatar l1={l1} role={role} />
          <div className="flex min-w-0 flex-1 flex-col leading-tight">
            <span className={cn('text-[10px] font-semibold uppercase tracking-[0.14em]', eyebrowTone)}>{eyebrow}</span>
            <span className="truncate text-sm font-medium text-zinc-900 dark:text-zinc-100">
              {l1?.name ?? 'Select a chain'}
            </span>
            <span className="flex items-center gap-1.5 text-[11px] text-zinc-500 dark:text-zinc-400">
              <span
                aria-hidden
                className={cn(
                  'h-1.5 w-1.5 shrink-0 rounded-full',
                  deployed ? 'bg-emerald-500' : 'bg-zinc-300 dark:bg-zinc-700',
                )}
              />
              {deployed && deployedAddress ? (
                <span className="font-mono text-zinc-600 dark:text-zinc-300">
                  {deployedLabel} · {truncateAddress(deployedAddress)}
                </span>
              ) : (
                <span>{emptyLabel}</span>
              )}
            </span>
          </div>
          <ChevronRight
            className="h-4 w-4 shrink-0 text-zinc-400 opacity-0 transition-opacity group-hover/side:opacity-100"
            aria-hidden
          />
        </button>
      </SheetTrigger>
      <SheetContent side="right" className="flex w-full max-w-md flex-col gap-0 p-0 sm:max-w-md">
        <SheetHeader className="border-b border-zinc-100 px-4 py-3 dark:border-zinc-800/80">
          <SheetTitle className="flex items-center gap-2 text-sm font-semibold">
            <Layers aria-hidden className="h-4 w-4" />
            {sheetTitle}
          </SheetTitle>
        </SheetHeader>
        <div className="flex-1 overflow-y-auto px-4 py-4">{sheetBody}</div>
      </SheetContent>
    </Sheet>
  );
}

function ChainAvatar({ l1, role }: { l1: L1ListItem | null; role: 'home' | 'remote' }) {
  const fallbackTone =
    role === 'home'
      ? 'bg-red-100 text-red-700 dark:bg-red-950/30 dark:text-red-300'
      : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300';
  if (!l1?.logoUrl) {
    return (
      <span
        aria-hidden
        className={cn(
          'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-xs font-semibold uppercase',
          fallbackTone,
        )}
      >
        {l1?.name?.slice(0, 1) ?? '?'}
      </span>
    );
  }
  return (
    <span className="relative h-9 w-9 shrink-0 overflow-hidden rounded-lg bg-white ring-1 ring-zinc-200/80 dark:bg-zinc-900 dark:ring-zinc-700/80">
      <Image src={l1.logoUrl} alt="" width={36} height={36} className="h-9 w-9 object-contain" unoptimized />
    </span>
  );
}

function ICMPill({ events }: { events: ActivityEvent[] }) {
  const [open, setOpen] = useState(false);
  const count = events.length;
  const hasRecent = count > 0;
  return (
    <div className="flex items-center justify-center md:px-1">
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <button
            type="button"
            aria-haspopup="dialog"
            aria-label={`ICM messaging log, ${count} recent ${count === 1 ? 'message' : 'messages'}`}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-full border border-zinc-200 bg-white px-2.5 py-1 text-[11px] font-medium shadow-sm transition-colors',
              'hover:border-zinc-300 hover:bg-zinc-50',
              'dark:border-zinc-800 dark:bg-zinc-900 dark:hover:bg-zinc-800/40',
            )}
          >
            <MessageSquare aria-hidden className="h-3 w-3 text-zinc-400" />
            <span
              aria-hidden
              className={cn('h-1.5 w-1.5 rounded-full', hasRecent ? 'animate-pulse bg-emerald-500' : 'bg-zinc-400')}
            />
            <span className="font-mono text-zinc-700 dark:text-zinc-200">ICM {count}</span>
          </button>
        </SheetTrigger>
        <SheetContent side="right" className="flex w-full max-w-md flex-col gap-0 p-0 sm:max-w-md">
          <SheetHeader className="border-b border-zinc-100 px-4 py-3 dark:border-zinc-800/80">
            <SheetTitle className="flex items-center gap-2 text-sm font-semibold">
              <MessageSquare aria-hidden className="h-4 w-4" />
              Interchain Messaging log
            </SheetTitle>
          </SheetHeader>
          <div className="flex-1 overflow-y-auto px-4 py-4">
            {events.length === 0 ? (
              <p className="rounded-lg border border-dashed border-zinc-200 px-3 py-8 text-center text-xs text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
                No ICM messages in the last hour.
              </p>
            ) : (
              <ul className="flex flex-col gap-2">
                {events.map((e) => (
                  <li
                    key={e.id}
                    className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-800 dark:bg-zinc-950/40"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium text-zinc-900 dark:text-zinc-100">{e.label}</span>
                      <span className="text-[11px] text-zinc-500">{formatRelativeTime(e.timestampMs)}</span>
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-2 font-mono text-[11px] text-zinc-500 dark:text-zinc-400">
                      {e.icmMessageId && <span>msg {truncateAddress(e.icmMessageId, 8, 4)}</span>}
                      {e.txHash && <span>tx {truncateAddress(e.txHash)}</span>}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}

function Divider() {
  return (
    <span
      aria-hidden
      className={cn(
        'hidden self-stretch border-t border-dashed border-zinc-200 dark:border-zinc-800',
        'md:block md:border-l md:border-t-0',
      )}
    />
  );
}

interface PickDestinationSheetProps {
  homeL1Id: string | null;
  /** When set, the trigger shows the "pending deploy" state for this chain. */
  pendingL1Id?: string | null;
  onConfirm: (l1Id: string) => void;
}

/**
 * Renders the empty Remote ribbon slot as a Sheet trigger. Clicking opens a
 * chain picker; selection is non-binding until the user clicks the explicit
 * "Continue in Phase 3" button — at which point the parent routes to Phase 3
 * with `?destination=<l1Id>` so the inspector pre-fills.
 */
function PickDestinationSheet({ homeL1Id, pendingL1Id, onConfirm }: PickDestinationSheetProps) {
  const [open, setOpen] = useState(false);
  const [pendingId, setPendingId] = useState<string>(pendingL1Id ?? '');
  const l1List = useL1List();
  const candidates = useMemo(() => l1List.filter((l1: L1ListItem) => l1.id !== homeL1Id), [l1List, homeL1Id]);
  const selected = candidates.find((l1: L1ListItem) => l1.id === pendingId) ?? null;
  const pendingChain = candidates.find((l1: L1ListItem) => l1.id === pendingL1Id) ?? null;

  // Re-sync the highlighted choice with the store whenever the Sheet opens.
  // Closing without confirming shouldn't leave a stale selection on next open.
  useEffect(() => {
    if (open) setPendingId(pendingL1Id ?? '');
  }, [open, pendingL1Id]);

  const handleConfirm = () => {
    if (!selected) return;
    onConfirm(selected.id);
    setOpen(false);
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        {pendingChain ? (
          <button
            type="button"
            aria-haspopup="dialog"
            aria-label={`${pendingChain.name} destination · pending deploy`}
            className={cn(
              'group/side flex flex-1 items-center gap-2.5 rounded-xl border border-transparent px-3 py-2 text-left transition-colors',
              'hover:border-emerald-200 hover:bg-emerald-50/40 dark:hover:border-emerald-900/60 dark:hover:bg-emerald-950/20',
            )}
          >
            <PickerAvatar l1={pendingChain} />
            <div className="flex min-w-0 flex-1 flex-col leading-tight">
              <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-emerald-600 dark:text-emerald-400">
                Remote · Destination
              </span>
              <span className="truncate text-sm font-medium text-zinc-900 dark:text-zinc-100">{pendingChain.name}</span>
              <span className="flex items-center gap-1.5 text-[11px] text-amber-600 dark:text-amber-400">
                <span aria-hidden className="h-1.5 w-1.5 shrink-0 rounded-full bg-amber-400" />
                Pending deploy
              </span>
            </div>
            <ChevronRight
              className="h-4 w-4 shrink-0 text-zinc-400 opacity-0 transition-opacity group-hover/side:opacity-100"
              aria-hidden
            />
          </button>
        ) : (
          <button
            type="button"
            aria-haspopup="dialog"
            aria-label="Pick destination chain"
            className={cn(
              'group/side flex flex-1 items-center gap-2 rounded-xl border border-dashed border-emerald-300/60 bg-emerald-50/40 px-3 py-2 text-left transition-colors',
              'hover:border-emerald-400 hover:bg-emerald-50/70',
              'dark:border-emerald-900/60 dark:bg-emerald-950/20 dark:hover:bg-emerald-950/40',
            )}
          >
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
              <Plus className="h-3.5 w-3.5" aria-hidden />
            </span>
            <div className="flex flex-1 flex-col">
              <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-emerald-600 dark:text-emerald-400">
                Remote · Destination
              </span>
              <span className="text-sm font-medium text-emerald-900 dark:text-emerald-100">Pick destination chain</span>
            </div>
            <ChevronRight
              className="h-4 w-4 text-emerald-500 opacity-70 transition-opacity group-hover/side:opacity-100"
              aria-hidden
            />
          </button>
        )}
      </SheetTrigger>
      <SheetContent side="right" className="flex w-full max-w-md flex-col gap-0 p-0 sm:max-w-md">
        <SheetHeader className="border-b border-zinc-100 px-4 py-3 dark:border-zinc-800/80">
          <SheetTitle className="flex items-center gap-2 text-sm font-semibold">
            <Layers aria-hidden className="h-4 w-4" />
            Pick a destination chain
          </SheetTitle>
        </SheetHeader>
        <div className="flex-1 overflow-y-auto px-4 py-4">
          <p className="mb-3 text-xs text-zinc-500 dark:text-zinc-400">
            Where should bridged tokens land? Choose any L1 except the Home chain. We&apos;ll open Phase 3 with this
            chain pre-selected.
          </p>
          {candidates.length === 0 ? (
            <p className="rounded-lg border border-dashed border-zinc-200 px-3 py-6 text-center text-xs text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
              You only have one L1 registered. Add another to bridge.
            </p>
          ) : (
            <ul className="flex flex-col gap-1">
              {candidates.map((l1: L1ListItem) => {
                const active = pendingId === l1.id;
                return (
                  <li key={l1.id}>
                    <button
                      type="button"
                      onClick={() => setPendingId(l1.id)}
                      aria-pressed={active}
                      className={cn(
                        'flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm transition-colors',
                        active
                          ? 'bg-emerald-50 ring-1 ring-emerald-300 dark:bg-emerald-950/30 dark:ring-emerald-900/60'
                          : 'hover:bg-zinc-100/70 dark:hover:bg-zinc-800/40',
                      )}
                    >
                      <PickerAvatar l1={l1} />
                      <span className="flex-1 truncate font-medium text-zinc-900 dark:text-zinc-100">{l1.name}</span>
                      <span className="shrink-0 font-mono text-[10px] text-zinc-400">{l1.coinName}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
        <footer className="flex items-center justify-end gap-2 border-t border-zinc-100 px-4 py-3 dark:border-zinc-800/80">
          <button
            type="button"
            onClick={handleConfirm}
            disabled={!selected}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
              selected
                ? 'bg-emerald-600 text-white hover:bg-emerald-500'
                : 'cursor-not-allowed bg-zinc-100 text-zinc-400 dark:bg-zinc-800 dark:text-zinc-500',
            )}
          >
            {selected ? `Continue with ${selected.name}` : 'Select a chain to continue'}
            <ArrowRight className="h-3.5 w-3.5" aria-hidden />
          </button>
        </footer>
      </SheetContent>
    </Sheet>
  );
}

function PickerAvatar({ l1 }: { l1: L1ListItem }) {
  if (!l1.logoUrl) {
    return (
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-zinc-200 text-[10px] font-semibold uppercase text-zinc-600 dark:bg-zinc-700 dark:text-zinc-300">
        {l1.name.slice(0, 1)}
      </span>
    );
  }
  return (
    <span className="relative h-6 w-6 shrink-0 overflow-hidden rounded-md bg-white ring-1 ring-zinc-200 dark:bg-zinc-900 dark:ring-zinc-700">
      <Image src={l1.logoUrl} alt="" width={24} height={24} className="h-6 w-6 object-contain" unoptimized />
    </span>
  );
}
