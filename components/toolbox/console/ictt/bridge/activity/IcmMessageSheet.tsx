'use client';

import { Check, Copy } from 'lucide-react';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { useL1ByChainId, useL1List, type L1ListItem } from '@/components/toolbox/stores/l1ListStore';
import { useIcttBridgeStore } from '@/components/toolbox/stores/iccttBridgeStore';
import { useCopyToClipboard } from '@/hooks/use-copy-to-clipboard';
import { buildTxUrl, truncateAddress } from '../utils/explorer-url';
import { formatRelativeTime } from '../utils/relative-time';
import {
  BODY,
  EYEBROW,
  HoverArrow,
  Route,
  RouteEnd,
  SHEET_CONTENT,
  SheetBody,
  SheetHead,
  StatusTag,
  Timeline,
  TimelineStep,
  type Tone,
} from '../ui';
import type { ActivityEvent } from '../types';

interface IcmMessageSheetProps {
  /** The source-side event (kind: 'send' | 'register-sent') whose row was clicked. */
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
 * Composition: route (source → destination) + a two-step delivery timeline.
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
        <SheetContent side="right" className={SHEET_CONTENT}>
          <SheetHead eyebrow="ICM message" title="No message selected" />
          <SheetBody>
            <p className={BODY}>Pick a row in the bridge log to see its message.</p>
          </SheetBody>
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
  const destinationName = (paired ? destinationL1?.name : fallbackDestinationLabel) ?? '—';

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className={SHEET_CONTENT}>
        <SheetHead eyebrow="ICM message" title={directionLabel(event.kind)} />
        <SheetBody className="flex flex-col gap-6">
          <div className="flex items-center justify-between gap-3">
            <span className={EYEBROW}>Status</span>
            <StatusTag tone={STATUS_TONE[event.status]} pulse={event.status === 'pending'}>
              {event.status}
            </StatusTag>
          </div>

          {event.icmMessageId && (
            <section className="flex flex-col gap-2">
              <span className={EYEBROW}>Message ID</span>
              <button
                type="button"
                onClick={() => void copyToClipboard(event.icmMessageId!, 'message-id')}
                className="group/act flex h-10 items-center justify-between gap-3 border border-zinc-200 px-3 font-mono text-[12px] text-zinc-700 transition-colors hover:border-zinc-900 hover:text-zinc-900 dark:border-zinc-800 dark:text-zinc-300 dark:hover:border-zinc-100 dark:hover:text-zinc-50"
                aria-label="Copy ICM message ID"
              >
                <span className="truncate">{event.icmMessageId}</span>
                {copiedId === 'message-id' ? (
                  <Check aria-hidden className="h-3 w-3 shrink-0 text-[#E6212F]" />
                ) : (
                  <Copy aria-hidden className="h-3 w-3 shrink-0" />
                )}
              </button>
            </section>
          )}

          <Route
            from={
              <RouteEnd
                side="Source"
                name={sourceL1?.name ?? '—'}
                detail={typeof event.timestampMs === 'number' ? formatRelativeTime(event.timestampMs) : undefined}
              />
            }
            to={
              <RouteEnd
                side="Destination"
                name={destinationName}
                detail={paired ? formatRelativeTime(paired.timestampMs) : 'In flight'}
              />
            }
            stacked
          />

          <Timeline label="Message delivery">
            <TimelineStep
              index={1}
              state={event.txHash ? 'complete' : event.status === 'failed' ? 'error' : 'active'}
              label={event.label}
              detail={
                <>
                  {event.sublabel && <span className="block">{event.sublabel}</span>}
                  {event.txHash && <TxLine hash={event.txHash} href={sourceTxUrl} />}
                </>
              }
            />
            <TimelineStep
              index={2}
              state={paired ? 'complete' : event.status === 'failed' ? 'error' : 'active'}
              label={paired?.label ?? 'Waiting for cross-chain delivery'}
              detail={
                <>
                  <span className="block">{paired?.sublabel ?? 'In flight via Teleporter.'}</span>
                  {paired?.txHash && <TxLine hash={paired.txHash} href={destinationTxUrl} />}
                </>
              }
            />
          </Timeline>
        </SheetBody>
      </SheetContent>
    </Sheet>
  );
}

const STATUS_TONE: Record<ActivityEvent['status'], Tone> = {
  pending: 'pending',
  confirmed: 'idle',
  delivered: 'ok',
  failed: 'error',
};

function directionLabel(kind: ActivityEvent['kind']) {
  return kind === 'register-sent'
    ? 'Registration message'
    : kind === 'send'
      ? 'Token transfer message'
      : kind === 'receive'
        ? 'Token transfer delivery'
        : kind === 'register-received'
          ? 'Registration delivery'
          : 'Cross-chain message';
}

function TxLine({ hash, href }: { hash: string; href: string | null }) {
  return (
    <span className="mt-1 flex items-center gap-2 font-mono text-[11px] text-zinc-500 dark:text-zinc-400">
      <span>tx {truncateAddress(hash, 8, 6)}</span>
      {href && (
        <a
          href={href}
          target="_blank"
          rel="noreferrer"
          aria-label="Open transaction in explorer"
          className="group/act inline-flex items-center gap-1 font-bold uppercase tracking-[0.14em] text-zinc-500 underline-offset-4 transition-colors hover:text-zinc-900 hover:underline dark:text-zinc-400 dark:hover:text-zinc-100"
        >
          Explorer
          <HoverArrow />
        </a>
      )}
    </span>
  );
}
