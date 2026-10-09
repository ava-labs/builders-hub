'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronDown, ChevronRight, Plus, RotateCcw } from 'lucide-react';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Button } from '@/components/toolbox/components/Button';
import { Alert } from '@/components/toolbox/components/Alert';
import { useIcttBridgeStore } from '@/components/toolbox/stores/iccttBridgeStore';
import { useL1List, type L1ListItem } from '@/components/toolbox/stores/l1ListStore';
import { useWalletStore } from '@/components/toolbox/stores/walletStore';
import { useWallet } from '@/components/toolbox/hooks/useWallet';
import { useModalTrigger } from '@/components/toolbox/hooks/useModal';
import { cn } from '@/lib/utils';
import { useBridgeContext } from './hooks/useBridgeContext';
import { useDeliveryWatcher } from './hooks/useDeliveryWatcher';
import { HomeChainCard } from './HomeChainCard';
import { RemoteChainCard } from './RemoteChainCard';
import { RemoteTabs } from './RemoteTabs';
import { IcmMessageSheet } from './activity/IcmMessageSheet';
import { truncateAddress } from './utils/explorer-url';
import { formatRelativeTime } from './utils/relative-time';
import { BRIDGE_BASE_PATH } from './bridge-steps';
import {
  BODY,
  ChainMark,
  Dot,
  EYEBROW,
  HoverArrow,
  ListRow,
  ListRows,
  SHEET_CONTENT,
  SheetBody,
  SheetFoot,
  SheetHead,
  StatusTag,
  TextAction,
  type Tone,
} from './ui';
import type { ActivityEvent, Address } from './types';

const RECENT_WINDOW_MS = 60 * 60 * 1000;

const CELL = 'min-w-0 bg-white dark:bg-zinc-950';
const SIDE = 'group/act flex w-full min-w-0 items-start gap-3 px-4 py-3.5 text-left';
const SIDE_NAME =
  'flex min-w-0 items-center gap-1.5 text-[14px] font-semibold text-zinc-900 decoration-zinc-400 underline-offset-4 group-hover/act:underline dark:text-zinc-50 dark:decoration-zinc-500';

/**
 * Compact summary of the bridge identity: Home → ICM → Remote, as two hairline
 * cells joined by a mono arrow. Each side opens the full chain-card detail in a
 * Sheet so users can still inspect addresses, rows and connection state.
 */
export function BridgeRibbon() {
  const ctx = useBridgeContext();
  const router = useRouter();
  const allActivity = useIcttBridgeStore((s) => s.activityLog);
  // Closes the bridge delivery loop globally: backfills any pending `send` /
  // `register-sent` activity rows against the destination chain's Teleporter
  // and watches for new `ReceiveCrossChainMessage` events while mounted.
  useDeliveryWatcher();
  // Show every bridge event (deploy, register, collateral, send, …) for the
  // active bridge in the recent window — not just ICM-tagged ones. ICM-bearing
  // rows surface a `msg 0x…` line that opens the IcmMessageSheet detail view.
  const bridgeEvents = useMemo(() => {
    const now = Date.now();
    return allActivity
      .filter((e) => {
        if (ctx.activeBridgeId && e.bridgeId !== ctx.activeBridgeId) return false;
        return now - e.timestampMs <= RECENT_WINDOW_MS;
      })
      .sort((a, b) => b.timestampMs - a.timestampMs);
  }, [allActivity, ctx.activeBridgeId]);

  // The "New bridge" CTA lives in `BridgeLayout`'s navTrailing. Keep the
  // handler here for the locked-Home sheet, which still offers a reset path.
  const handleStartNewBridge = () => {
    ctx.startNewBridge();
    router.push(`${BRIDGE_BASE_PATH}/token`);
  };

  return (
    <div className="flex w-full flex-col gap-4">
      {ctx.remotes.length > 1 && (
        <RemoteTabs
          remotes={ctx.remotes}
          selectedRemoteId={ctx.selectedRemoteId}
          onSelect={ctx.selectRemote}
          onRemoveFromView={ctx.removeRemoteFromView}
        />
      )}
      <div className="grid grid-cols-1 gap-px border border-zinc-200 bg-zinc-200 md:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] dark:border-zinc-800 dark:bg-zinc-800">
        <div className={CELL}>
          <HomeSide />
        </div>
        <div className={cn(CELL, 'flex items-center justify-center')}>
          <BridgeLog events={bridgeEvents} />
        </div>
        <div className={CELL}>
          <RemoteSide />
        </div>
      </div>
    </div>
  );

  function HomeSide() {
    // The Home picker is disabled once TokenHome is deployed — `bridge.homeL1Id`
    // is the contract's chain and can't be migrated without re-deploying. The
    // user still gets the explainer + a "Start new bridge" suggestion below.
    const homeIsLocked = Boolean(ctx.bridge?.homeAddress);
    return (
      <RibbonSide
        role="home"
        l1={ctx.homeL1 ?? null}
        deployed={Boolean(ctx.bridge?.homeAddress)}
        deployedAddress={ctx.bridge?.homeAddress ?? null}
        deployedLabel="TokenHome"
        emptyLabel="Setup pending"
        sheetTitle={ctx.homeL1 ? ctx.homeL1.name : 'Home chain'}
        sheetBody={
          <div className="flex flex-col gap-6">
            <ChangeHomeL1Section
              currentHomeL1Id={ctx.homeL1?.id ?? null}
              locked={homeIsLocked}
              onStartNewBridge={handleStartNewBridge}
            />
            <HomeChainCard
              homeL1={ctx.homeL1 ?? null}
              bridge={ctx.bridge}
              activePhase={ctx.phase}
              isWalletOnHome={ctx.isWalletOnHome}
            />
          </div>
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
          sheetTitle={ctx.remoteL1 ? ctx.remoteL1.name : 'Remote chain'}
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
          className="flex min-w-0 cursor-not-allowed items-start gap-3 px-4 py-3.5"
          aria-label="Pick destination chain (disabled — deploy TokenHome first)"
        >
          <span className="flex h-9 w-9 shrink-0 items-center justify-center border border-dashed border-zinc-300 text-zinc-400 dark:border-zinc-700 dark:text-zinc-600">
            <Plus className="h-3.5 w-3.5" aria-hidden />
          </span>
          <div className="flex min-w-0 flex-col gap-0.5">
            <span className={EYEBROW}>Remote · Destination</span>
            <span className="text-[14px] font-semibold text-zinc-400 dark:text-zinc-500">Deploy TokenHome first</span>
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

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <button
          type="button"
          aria-haspopup="dialog"
          aria-label={`${role === 'home' ? 'Home' : 'Remote'} chain details`}
          className={SIDE}
        >
          <ChainMark l1={l1} />
          <div className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span className={EYEBROW}>{eyebrow}</span>
            <span className={SIDE_NAME}>
              <span className="truncate">{l1?.name ?? 'Select a chain'}</span>
              <HoverArrow />
            </span>
            <span className="flex min-w-0 items-center gap-1.5 font-mono text-[11px] text-zinc-500 dark:text-zinc-400">
              <Dot tone={deployed ? 'ok' : 'idle'} />
              {deployed && deployedAddress ? (
                <span className="truncate text-zinc-700 dark:text-zinc-300">
                  {deployedLabel} {truncateAddress(deployedAddress)}
                </span>
              ) : (
                <span className="truncate">{emptyLabel}</span>
              )}
            </span>
          </div>
        </button>
      </SheetTrigger>
      <SheetContent side="right" className={SHEET_CONTENT}>
        <SheetHead eyebrow={role === 'home' ? 'Home chain' : 'Remote chain'} title={sheetTitle} />
        <SheetBody>{sheetBody}</SheetBody>
      </SheetContent>
    </Sheet>
  );
}

/**
 * The ribbon's centre: the mono arrow between the two chains doubles as the
 * entry point to the bridge's activity log. A count follows once there are
 * events; an amber pulse marks anything still in flight.
 *
 * ICM-specific rows surface a `msg 0x…` line that opens the `IcmMessageSheet`
 * for deep inspection — message ID is captured from the Teleporter
 * `SendCrossChainMessage` event in `useRegisterRemote` and `useSendTokens`.
 */
function BridgeLog({ events }: { events: ActivityEvent[] }) {
  const [open, setOpen] = useState(false);
  const [detailEvent, setDetailEvent] = useState<ActivityEvent | null>(null);
  const count = events.length;
  const hasEvents = count > 0;
  // "Pending" means any row that's not yet at terminal state (delivered /
  // failed / standalone confirmed). Both `pending` and the
  // `confirmed-but-not-delivered` state should pulse.
  const hasPending = events.some(
    (e) => e.status === 'pending' || (e.status === 'confirmed' && (e.kind === 'send' || e.kind === 'register-sent')),
  );
  return (
    <>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <button
            type="button"
            aria-haspopup="dialog"
            aria-label={`Bridge log, ${count} recent ${count === 1 ? 'event' : 'events'}${hasPending ? ', some pending' : ''}`}
            title="Open bridge activity log"
            className="group/act flex h-full w-full flex-col items-center justify-center gap-1 px-5 py-3 md:min-w-[7.5rem]"
          >
            <span aria-hidden className="font-mono text-[13px] text-zinc-400 dark:text-zinc-500">
              <span className="md:hidden">↓</span>
              <span className="hidden md:inline">→</span>
            </span>
            <span className="inline-flex items-center gap-1.5 font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-zinc-500 underline-offset-4 transition-colors group-hover/act:text-zinc-900 group-hover/act:underline dark:text-zinc-400 dark:group-hover/act:text-zinc-100">
              {hasPending && <Dot tone="pending" pulse />}
              ICM log
              {hasEvents && <span className="tabular-nums">{count > 99 ? '99+' : count}</span>}
            </span>
          </button>
        </SheetTrigger>
        <SheetContent side="right" className={SHEET_CONTENT}>
          <SheetHead eyebrow="Last hour" title="Bridge activity" />
          <SheetBody>
            {events.length === 0 ? (
              <div className="flex flex-col gap-2 border border-zinc-200 px-4 py-6 dark:border-zinc-800">
                <p className={EYEBROW}>No activity</p>
                <p className={BODY}>Nothing happened on this bridge in the last hour.</p>
              </div>
            ) : (
              <ActivityList events={events} onSelect={(e) => setDetailEvent(e)} />
            )}
          </SheetBody>
        </SheetContent>
      </Sheet>
      <IcmMessageSheet
        event={detailEvent}
        open={detailEvent !== null}
        onOpenChange={(o) => !o && setDetailEvent(null)}
      />
    </>
  );
}

/**
 * Groups paired events (`send + receive`, `register-sent + register-received`)
 * into one expandable row; renders everything else as singletons. The source
 * row is what the user actually cares about — the receive row is collapsed
 * into a status tag until expanded.
 */
function ActivityList({ events, onSelect }: { events: ActivityEvent[]; onSelect: (event: ActivityEvent) => void }) {
  // First pass: build pair map keyed by canonical source id. For sources the
  // canonical id is itself; for receives the canonical id is `pairedWith`.
  const pairs = useMemo(() => {
    const byCanonical = new Map<string, { source: ActivityEvent; paired?: ActivityEvent }>();
    for (const e of events) {
      const isReceive = e.kind === 'receive' || e.kind === 'register-received';
      const canonical = isReceive && e.pairedWith ? e.pairedWith : e.id;
      const existing = byCanonical.get(canonical);
      if (isReceive) {
        if (existing) existing.paired = e;
        else byCanonical.set(canonical, { source: e, paired: e });
      } else {
        if (existing) existing.source = e;
        else byCanonical.set(canonical, { source: e });
      }
    }
    return Array.from(byCanonical.values()).sort((a, b) => b.source.timestampMs - a.source.timestampMs);
  }, [events]);

  return (
    <ul className="divide-y divide-zinc-200 border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
      {pairs.map(({ source, paired }) => (
        <ActivityRow key={source.id} source={source} paired={paired ?? null} onSelect={onSelect} />
      ))}
    </ul>
  );
}

function ActivityRow({
  source,
  paired,
  onSelect,
}: {
  source: ActivityEvent;
  paired: ActivityEvent | null;
  onSelect: (event: ActivityEvent) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const isPairable = source.kind === 'send' || source.kind === 'register-sent';
  const statusForRow: ActivityEvent['status'] = paired ? 'delivered' : source.status;
  const canExpand = !source.icmMessageId && isPairable;
  return (
    <li>
      <button
        type="button"
        onClick={() => {
          if (source.icmMessageId) {
            onSelect(source);
          } else if (isPairable) {
            setExpanded((x) => !x);
          }
        }}
        className="group/act flex w-full items-start justify-between gap-3 px-4 py-3 text-left"
        aria-label={source.icmMessageId ? `Open ICM message detail for ${source.label}` : source.label}
      >
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <div className="flex items-baseline justify-between gap-3">
            <span className="flex min-w-0 items-center gap-1.5 text-[13px] font-medium text-zinc-900 underline-offset-4 group-hover/act:underline dark:text-zinc-50">
              <span className="truncate">{source.label}</span>
              {source.icmMessageId && <HoverArrow />}
            </span>
            <span className="shrink-0 font-mono text-[10.5px] tabular-nums text-zinc-400 dark:text-zinc-500">
              {formatRelativeTime(source.timestampMs)}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[11px] text-zinc-500 dark:text-zinc-400">
            {source.icmMessageId && <span>msg {truncateAddress(source.icmMessageId, 8, 4)}</span>}
            {source.txHash && <span>tx {truncateAddress(source.txHash)}</span>}
            <ActivityStatus status={statusForRow} />
            {canExpand && paired && (
              <span className="ml-auto text-zinc-400">
                {expanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
              </span>
            )}
          </div>
        </div>
      </button>
      {expanded && paired && (
        <div className="border-t border-dashed border-zinc-200 px-4 py-3 text-[12px] text-zinc-600 dark:border-zinc-800 dark:text-zinc-300">
          <div className="font-medium text-zinc-900 dark:text-zinc-100">{paired.label}</div>
          {paired.sublabel && <div className="mt-0.5">{paired.sublabel}</div>}
          {paired.txHash && (
            <div className="mt-1 font-mono text-[11px] text-zinc-500 dark:text-zinc-400">
              tx {truncateAddress(paired.txHash, 8, 6)}
            </div>
          )}
        </div>
      )}
    </li>
  );
}

const ACTIVITY_TONE: Record<ActivityEvent['status'], Tone> = {
  delivered: 'ok',
  failed: 'error',
  confirmed: 'idle',
  pending: 'pending',
};

function ActivityStatus({ status }: { status: ActivityEvent['status'] }) {
  return (
    <StatusTag tone={ACTIVITY_TONE[status]} pulse={status === 'pending'}>
      {status}
    </StatusTag>
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
 * "Continue" button — at which point the parent routes to Phase 3 with
 * `?destination=<l1Id>` so the inspector pre-fills.
 */
function PickDestinationSheet({ homeL1Id, pendingL1Id, onConfirm }: PickDestinationSheetProps) {
  const [open, setOpen] = useState(false);
  const [pendingId, setPendingId] = useState<string>(pendingL1Id ?? '');
  const l1List = useL1List();
  const { openModal: openAddChainModal } = useModalTrigger();
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
            className={SIDE}
          >
            <ChainMark l1={pendingChain} />
            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className={EYEBROW}>Remote · Destination</span>
              <span className={SIDE_NAME}>
                <span className="truncate">{pendingChain.name}</span>
                <HoverArrow />
              </span>
              <StatusTag tone="pending">Pending deploy</StatusTag>
            </div>
          </button>
        ) : (
          <button type="button" aria-haspopup="dialog" aria-label="Pick destination chain" className={SIDE}>
            <span className="flex h-9 w-9 shrink-0 items-center justify-center border border-dashed border-zinc-400 text-zinc-600 transition-colors group-hover/act:border-zinc-900 group-hover/act:text-zinc-900 dark:border-zinc-600 dark:text-zinc-300 dark:group-hover/act:border-zinc-100 dark:group-hover/act:text-zinc-50">
              <Plus className="h-3.5 w-3.5" aria-hidden />
            </span>
            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className={EYEBROW}>Remote · Destination</span>
              <span className={SIDE_NAME}>
                <span className="truncate">Pick destination chain</span>
                <HoverArrow />
              </span>
            </div>
          </button>
        )}
      </SheetTrigger>
      <SheetContent side="right" className={SHEET_CONTENT}>
        <SheetHead eyebrow="Remote chain" title="Pick a destination" />
        <SheetBody className="flex flex-col gap-4">
          <p className={BODY}>
            Where should bridged tokens land? Pick any L1 except the Home chain. Phase 3 opens with it selected.
          </p>
          {candidates.length === 0 ? (
            <div className="flex flex-col items-start gap-3 border border-zinc-200 px-4 py-5 dark:border-zinc-800">
              <p className={EYEBROW}>No other chains</p>
              <p className={BODY}>Only the Home L1 is registered. Add another L1 to bridge to.</p>
              <TextAction icon={Plus} onClick={() => void openAddChainModal()}>
                Add a chain
              </TextAction>
            </div>
          ) : (
            <>
              <ListRows>
                {candidates.map((l1: L1ListItem) => (
                  <ListRow key={l1.id} selected={pendingId === l1.id} onClick={() => setPendingId(l1.id)}>
                    <ChainMark l1={l1} size="sm" />
                    <span
                      data-row-title
                      className="min-w-0 flex-1 truncate text-[13px] font-medium text-zinc-900 dark:text-zinc-50"
                    >
                      {l1.name}
                    </span>
                    <span className="shrink-0 font-mono text-[10.5px] text-zinc-400 dark:text-zinc-500">
                      {l1.coinName}
                    </span>
                  </ListRow>
                ))}
              </ListRows>
              <TextAction icon={Plus} tone="muted" onClick={() => void openAddChainModal()}>
                Add a chain
              </TextAction>
            </>
          )}
        </SheetBody>
        <SheetFoot>
          <Button onClick={handleConfirm} disabled={!selected} className="w-auto">
            {selected ? `Continue with ${selected.name}` : 'Select a chain'}
          </Button>
        </SheetFoot>
      </SheetContent>
    </Sheet>
  );
}

interface ChangeHomeL1SectionProps {
  currentHomeL1Id: string | null;
  /** When true, the user can't switch home (TokenHome is already deployed). */
  locked: boolean;
  onStartNewBridge: () => void;
}

/**
 * Inline "Change Home L1" picker shown inside the Home sheet. Lets the user
 * pick any L1 from the store; selecting calls `walletClient.switchChain`, which
 * updates `useSelectedL1()` reactively. When the bridge already has TokenHome
 * deployed, the picker is read-only and points to "Start new bridge".
 */
function ChangeHomeL1Section({ currentHomeL1Id, locked, onStartNewBridge }: ChangeHomeL1SectionProps) {
  const l1List = useL1List();
  const { switchChainOrAdd } = useWallet();
  const walletChainId = useWalletStore((s) => s.walletChainId);
  const { openModal: openAddChainModal } = useModalTrigger();
  const [isSwitching, setIsSwitching] = useState<string | null>(null);

  const handlePick = async (l1: L1ListItem) => {
    if (locked) return;
    if (l1.evmChainId === walletChainId) return;
    setIsSwitching(l1.id);
    try {
      // `switchChainOrAdd` falls back to wallet_addEthereumChain if the L1
      // isn't already in the wallet — common for fresh user-created L1s.
      // Errors are surfaced via toast inside the helper.
      await switchChainOrAdd(l1);
    } finally {
      setIsSwitching(null);
    }
  };

  return (
    <section className="flex flex-col gap-3">
      <header className="flex flex-col gap-1.5">
        <span className={EYEBROW}>Home L1</span>
        <p className={BODY}>
          Home is the L1 where your token lives. To bridge AVAX, keep Home on C-Chain. To bridge a token from your own
          L1, switch Home to it and your wallet follows.
        </p>
      </header>
      {locked && (
        <Alert variant="warning">
          <div className="flex flex-col items-start gap-2">
            <span>TokenHome is already deployed on this Home L1, so Home can&apos;t change here.</span>
            <TextAction icon={RotateCcw} onClick={onStartNewBridge}>
              Start new bridge
            </TextAction>
          </div>
        </Alert>
      )}
      <ListRows className={cn(locked && 'pointer-events-none')}>
        {l1List.map((l1: L1ListItem) => {
          const active = l1.id === currentHomeL1Id;
          return (
            <ListRow
              key={l1.id}
              selected={active}
              onClick={() => handlePick(l1)}
              disabled={locked || isSwitching !== null}
            >
              <ChainMark l1={l1} size="sm" />
              <span
                data-row-title
                className="min-w-0 flex-1 truncate text-[13px] font-medium text-zinc-900 dark:text-zinc-50"
              >
                {l1.name}
              </span>
              <span className="shrink-0 font-mono text-[10.5px] text-zinc-400 dark:text-zinc-500">
                {isSwitching === l1.id ? 'Switching…' : l1.coinName}
              </span>
              {active && <StatusTag tone="active">Current</StatusTag>}
            </ListRow>
          );
        })}
      </ListRows>
      <TextAction icon={Plus} tone="muted" onClick={() => void openAddChainModal()}>
        Add a chain
      </TextAction>
    </section>
  );
}
