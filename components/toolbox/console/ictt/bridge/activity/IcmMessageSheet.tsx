'use client';

import Link from 'next/link';
import { ArrowRight, Check, Copy, ExternalLink, MessageSquare } from 'lucide-react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { useL1ByChainId, useL1List, type L1ListItem } from '@/components/toolbox/stores/l1ListStore';
import { useIcttBridgeStore } from '@/components/toolbox/stores/iccttBridgeStore';
import { useCopyToClipboard } from '@/hooks/use-copy-to-clipboard';
import { cn } from '@/lib/utils';
import { buildTxUrl, truncateAddress } from '../utils/explorer-url';
import { formatRelativeTime } from '../utils/relative-time';
import type { ActivityEvent } from '../types';

interface IcmMessageSheetProps {
  /** The source-side event (kind: 'send' | 'register-sent') whose chip was clicked. */
  event: ActivityEvent | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Side sheet detail view for an ICM message. Pivots on the source event and
 * uses its `pairedWith` to surface the destination-side context when delivery
 * has been observed. Read-only — no on-chain calls beyond what's already in
 * the activity log; opens fast and works offline.
 *
 * Composition: source pane (always) + destination pane (paired or "waiting").
 */
export function IcmMessageSheet({ event, open, onOpenChange }: IcmMessageSheetProps) {
  // All hooks must run on every render — the early return for `null` event is
  // handled inside the JSX body, not before the hook calls.
  const activityLog = useIcttBridgeStore((s) => s.activityLog);
  const bridges = useIcttBridgeStore((s) => s.bridges);
  const l1List = useL1List();
  const { copiedId, copyToClipboard } = useCopyToClipboard();

  const sourceChainKey = event?.chainId !== undefined ? String(event.chainId) : '';
  const sourceL1 = useL1ByChainId(sourceChainKey);

  const paired = event?.pairedWith ? (activityLog.find((e) => e.id === event.pairedWith) ?? null) : null;
  const destinationChainKey = paired?.chainId !== undefined ? String(paired.chainId) : '';
  const destinationL1 = useL1ByChainId(destinationChainKey);

  if (!event) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="right" className="flex w-full max-w-md flex-col gap-0 p-0 sm:max-w-md">
          <SheetHeader className="border-b border-zinc-100 px-4 py-3 dark:border-zinc-800/80">
            <SheetTitle className="flex items-center gap-2 text-sm font-semibold">
              <MessageSquare aria-hidden className="h-4 w-4" />
              ICM Message
            </SheetTitle>
          </SheetHeader>
          <div className="px-4 py-4 text-xs text-zinc-500">No message selected.</div>
        </SheetContent>
      </Sheet>
    );
  }

  // When the source didn't capture a paired event yet, we can still infer the
  // destination chain from the source kind: send → remote chain, register-sent
  // → home chain. Fall back to a label so the user still sees the route.
  const fallbackDestinationLabel = (() => {
    if (paired) return destinationL1?.name ?? '—';
    if (!event.bridgeId) return '—';
    const bridge = bridges[event.bridgeId];
    if (!bridge) return '—';
    if (event.kind === 'send') {
      const remote = bridge.remotes.find((r) => r.id === event.remoteId);
      if (!remote) return '—';
      return l1List.find((l1: L1ListItem) => l1.id === remote.l1Id)?.name ?? remote.l1Id;
    }
    if (event.kind === 'register-sent') {
      return l1List.find((l1: L1ListItem) => l1.id === bridge.homeL1Id)?.name ?? bridge.homeL1Id;
    }
    return '—';
  })();

  const sourceTxUrl = buildTxUrl(sourceL1 ?? null, event.txHash ?? null);
  const destinationTxUrl = paired ? buildTxUrl(destinationL1 ?? null, paired.txHash ?? null) : null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex w-full max-w-md flex-col gap-0 p-0 sm:max-w-md">
        <SheetHeader className="border-b border-zinc-100 px-4 py-3 dark:border-zinc-800/80">
          <SheetTitle className="flex items-center gap-2 text-sm font-semibold">
            <MessageSquare aria-hidden className="h-4 w-4" />
            ICM Message
          </SheetTitle>
        </SheetHeader>
        <div className="flex-1 overflow-y-auto px-4 py-4">
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-500 dark:text-zinc-400">
                Status
              </span>
              <StatusPill status={event.status} />
            </div>

            {event.icmMessageId && (
              <section className="flex flex-col gap-1.5">
                <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-500 dark:text-zinc-400">
                  Message ID
                </span>
                <button
                  type="button"
                  onClick={() => void copyToClipboard(event.icmMessageId!, 'message-id')}
                  className="group inline-flex items-center justify-between gap-2 rounded-md border border-zinc-200 bg-zinc-50/60 px-2.5 py-1.5 font-mono text-[11px] text-zinc-700 transition-colors hover:bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-900/60 dark:text-zinc-300 dark:hover:bg-zinc-800/80"
                  aria-label="Copy ICM message ID"
                >
                  <span className="truncate">{event.icmMessageId}</span>
                  {copiedId === 'message-id' ? (
                    <Check aria-hidden className="h-3 w-3 shrink-0 text-emerald-500" />
                  ) : (
                    <Copy aria-hidden className="h-3 w-3 shrink-0 opacity-60 group-hover:opacity-100" />
                  )}
                </button>
              </section>
            )}

            <RouteSummary
              sourceName={sourceL1?.name ?? '—'}
              destinationName={fallbackDestinationLabel}
              kind={event.kind}
            />

            <section className="flex flex-col gap-2">
              <SidePanel
                role="source"
                chainName={sourceL1?.name ?? '—'}
                txHash={event.txHash}
                txUrl={sourceTxUrl}
                timestamp={event.timestampMs}
                label={event.label}
                sublabel={event.sublabel}
              />
              <SidePanel
                role="destination"
                chainName={(paired ? destinationL1?.name : fallbackDestinationLabel) ?? '—'}
                txHash={paired?.txHash}
                txUrl={destinationTxUrl}
                timestamp={paired?.timestampMs}
                label={paired?.label ?? 'Waiting for cross-chain delivery'}
                sublabel={paired?.sublabel ?? 'Message in flight via Teleporter'}
                isPending={!paired}
              />
            </section>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function RouteSummary({
  sourceName,
  destinationName,
  kind,
}: {
  sourceName: string;
  destinationName: string;
  kind: ActivityEvent['kind'];
}) {
  const direction =
    kind === 'register-sent'
      ? 'Registration message'
      : kind === 'send'
        ? 'Token transfer message'
        : kind === 'receive'
          ? 'Token transfer delivery'
          : kind === 'register-received'
            ? 'Registration delivery'
            : 'Cross-chain message';
  return (
    <section className="rounded-lg border border-zinc-200 bg-white px-3 py-2 dark:border-zinc-800 dark:bg-zinc-950/40">
      <div className="flex items-center justify-between gap-3 text-xs">
        <span className="font-medium text-zinc-700 dark:text-zinc-200">{direction}</span>
      </div>
      <div className="mt-1.5 flex items-center gap-2 text-sm">
        <span className="truncate font-medium text-zinc-900 dark:text-zinc-100">{sourceName}</span>
        <ArrowRight aria-hidden className="h-3.5 w-3.5 shrink-0 text-zinc-400" />
        <span className="truncate font-medium text-zinc-900 dark:text-zinc-100">{destinationName}</span>
      </div>
    </section>
  );
}

function SidePanel({
  role,
  chainName,
  txHash,
  txUrl,
  timestamp,
  label,
  sublabel,
  isPending,
}: {
  role: 'source' | 'destination';
  chainName: string;
  txHash?: string;
  txUrl: string | null;
  timestamp?: number;
  label: string;
  sublabel?: string;
  isPending?: boolean;
}) {
  const eyebrow = role === 'source' ? 'Source' : 'Destination';
  const tone =
    role === 'source'
      ? 'border-red-200/80 bg-red-50/40 dark:border-red-900/60 dark:bg-red-950/20'
      : isPending
        ? 'border-amber-200/80 bg-amber-50/40 dark:border-amber-900/60 dark:bg-amber-950/20'
        : 'border-emerald-200/80 bg-emerald-50/40 dark:border-emerald-900/60 dark:bg-emerald-950/20';
  return (
    <div className={cn('rounded-lg border px-3 py-2.5', tone)}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-500 dark:text-zinc-400">
          {eyebrow} · {chainName}
        </span>
        {typeof timestamp === 'number' && (
          <time className="text-[10px] text-zinc-400" dateTime={new Date(timestamp).toISOString()}>
            {formatRelativeTime(timestamp)}
          </time>
        )}
      </div>
      <div className="mt-1 text-sm font-medium text-zinc-900 dark:text-zinc-100">{label}</div>
      {sublabel && <div className="mt-0.5 text-xs text-zinc-600 dark:text-zinc-300">{sublabel}</div>}
      {txHash && (
        <div className="mt-2 flex items-center gap-2 font-mono text-[11px] text-zinc-500 dark:text-zinc-400">
          <span>tx</span>
          <span>{truncateAddress(txHash, 8, 6)}</span>
          {txUrl && (
            <Link
              href={txUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-0.5 text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-100"
              aria-label="Open transaction in explorer"
            >
              <ExternalLink aria-hidden className="h-3 w-3" />
            </Link>
          )}
        </div>
      )}
      {isPending && !txHash && (
        <div className="mt-2 flex items-center gap-1.5 text-[11px] text-amber-700 dark:text-amber-300">
          <span aria-hidden className="relative flex h-1.5 w-1.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-75" />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-amber-400" />
          </span>
          In flight via Teleporter
        </div>
      )}
    </div>
  );
}

function StatusPill({ status }: { status: ActivityEvent['status'] }) {
  const config: Record<ActivityEvent['status'], { label: string; tone: string }> = {
    pending: {
      label: 'Pending',
      tone: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300',
    },
    confirmed: {
      label: 'Confirmed',
      tone: 'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300',
    },
    delivered: {
      label: 'Delivered',
      tone: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300',
    },
    failed: {
      label: 'Failed',
      tone: 'bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300',
    },
  };
  const { label, tone } = config[status];
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider',
        tone,
      )}
    >
      {label}
    </span>
  );
}
