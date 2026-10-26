'use client';

import { useCallback, useEffect, useRef, type ReactNode } from 'react';
import { History, Check, X, Loader2, ExternalLink, Trash2, Copy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { DrawnCheck, MorphSlot } from '@/components/console/icon-morph';
import { useCopiedFlash } from '@/hooks/use-copied-flash';
import { EASE_OUT, cssEase } from '@/lib/motion-curves';
import { useNotificationPanelStore, type ConsoleNotification } from './store';
import { activityDotState, landedResult, newestLanding, type ActivityDotState } from './activity-dot-state';
import Link from 'next/link';

function timeAgo(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  return `${Math.floor(seconds / 3600)}h ago`;
}

/**
 * con-tx-landed: the explorer link or Copy Error opens with grid-template-rows 0fr to 1fr, 180ms on the strong
 * ease-out, so the rows below slide instead of jumping. The clip carries 4px of padding, cancelled by a negative
 * margin, so the focus ring (2px, offset 2px) is never cut. Reduce Motion: the site policy drops the row slide.
 */
function Reveal({ open, children }: { open: boolean; children: ReactNode }) {
  return (
    <div
      className={`grid transition-[grid-template-rows] duration-180 ease-out ${open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}
    >
      <div className="min-h-0 overflow-hidden -mx-1 px-1 -mb-1 pb-1">{children}</div>
    </div>
  );
}

function NotificationItem({ notification }: { notification: ConsoleNotification }) {
  const { removeNotification } = useNotificationPanelStore();
  const [copied, flashCopied] = useCopiedFlash(1500);
  const { status } = notification;

  const handleCopyError = useCallback(() => {
    navigator.clipboard.writeText(notification.message);
    flashCopied();
  }, [notification.message, flashCopied]);

  const bgClass =
    notification.status === 'loading'
      ? 'bg-zinc-50 dark:bg-zinc-800/50'
      : notification.status === 'success'
        ? 'bg-green-50/50 dark:bg-green-900/10'
        : 'bg-red-50/50 dark:bg-red-900/10';
  const showExplorerLink = Boolean(notification.explorerUrl) && status === 'success';

  // con-tx-landed: the spinner blurs out as the result blurs in (the check draws itself), the tint eases over and the
  // link slides open. The check and the cross pass 3:1, Copy Error and the time 4.5:1, in both themes.
  return (
    <div className={`px-3 py-2 ${bgClass} rounded-lg transition-[background-color] duration-200 ease-[ease]`}>
      <div className="flex items-start gap-2">
        <div className="mt-0.5 grid">
          <MorphSlot show={status === 'loading'}>
            <Loader2
              className={`h-3.5 w-3.5 text-zinc-400 animate-spin shrink-0 ${status === 'loading' ? '' : '[animation-play-state:paused]'}`}
            />
          </MorphSlot>
          <MorphSlot show={status === 'success'}>
            <DrawnCheck
              drawn={status === 'success'}
              className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400 shrink-0"
            />
          </MorphSlot>
          <MorphSlot show={status === 'error'}>
            <X className="h-3.5 w-3.5 text-red-600 dark:text-red-400 shrink-0" />
          </MorphSlot>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-medium text-zinc-900 dark:text-zinc-100 truncate">{notification.name}</span>
            <span className="text-[10px] text-zinc-500 dark:text-zinc-400 shrink-0">
              {timeAgo(notification.timestamp)}
            </span>
          </div>
          <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5 line-clamp-2">{notification.message}</p>
          <Reveal open={showExplorerLink || status === 'error'}>
            {showExplorerLink && (
              <a
                href={notification.explorerUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-[10px] text-blue-600 dark:text-blue-400 hover:underline mt-1"
              >
                View in Explorer <ExternalLink className="h-2.5 w-2.5" />
              </a>
            )}
            {status === 'error' && (
              // Both labels share one grid cell, so the button keeps the width of the longer one.
              <button
                onClick={handleCopyError}
                className="inline-grid text-[10px] text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 mt-1 transition-colors"
              >
                <MorphSlot show={!copied} className="justify-start gap-1">
                  Copy Error <Copy className="h-2.5 w-2.5" />
                </MorphSlot>
                <MorphSlot show={copied} className="justify-start gap-1">
                  Copied <Check className="h-2.5 w-2.5" />
                </MorphSlot>
              </button>
            )}
          </Reveal>
        </div>
        <button
          onClick={() => removeNotification(notification.id)}
          className="shrink-0 p-0.5 rounded hover:bg-zinc-200 dark:hover:bg-zinc-700 opacity-0 group-hover:opacity-100 transition-opacity"
        >
          <X className="h-3 w-3 text-zinc-400" />
        </button>
      </div>
    </div>
  );
}

/**
 * con-activity-dot: ink pulses while a transaction runs (the console keeps to ink, one red and the status colours);
 * then green after a success and red after a failure, each 3:1 or more on the header.
 */
const DOT: Record<Exclude<ActivityDotState, 'idle'>, string> = {
  busy: 'bg-zinc-900 dark:bg-zinc-100 animate-pulse motion-reduce:animate-none',
  success: 'bg-emerald-600 dark:bg-emerald-400',
  failure: 'bg-red-600 dark:bg-red-400',
};

/** One ring when a result lands, so a result that arrives while the builder looks elsewhere still gets noticed. */
const RING_KEYFRAMES: Keyframe[] = [
  { transform: 'scale(1)', opacity: 0.55 },
  { transform: 'scale(2.6)', opacity: 0 },
];

export function ConsoleNotificationPanel() {
  const { notifications, isOpen, setOpen, clearAll } = useNotificationPanelStore();
  const hasNotifications = notifications.length > 0;
  const dot = activityDotState(notifications);
  const ringRef = useRef<HTMLSpanElement>(null);
  // The newest landing the dot has seen: it rings only for a newer one, so a removed row never rings.
  const seenLanding = useRef(newestLanding(notifications));

  useEffect(() => {
    const { landed, seen } = landedResult(seenLanding.current, notifications);
    seenLanding.current = seen;
    // Reduce Motion: no ring; the dot only changes colour, which the site's reduced-motion rule fades in 150ms.
    if (!landed || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    ringRef.current?.animate(RING_KEYFRAMES, { duration: 700, easing: cssEase(EASE_OUT) });
  }, [notifications]);

  return (
    <Popover open={isOpen} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" title="Transaction Activity" className="relative">
          <History className="h-4 w-4" />
          {dot !== 'idle' && (
            <span aria-hidden className={`absolute top-1.5 right-1.5 h-2 w-2 rounded-full ${DOT[dot]}`}>
              <span ref={ringRef} className="absolute inset-0 rounded-full bg-inherit opacity-0" />
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0 overflow-hidden" sideOffset={8}>
        {/* Header */}
        <div className="flex items-center justify-between px-3 py-2 border-b border-zinc-200 dark:border-zinc-800">
          <span className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">Activity</span>
          <div className="flex items-center gap-1">
            {hasNotifications && (
              <button
                onClick={clearAll}
                className="p-1 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                title="Clear all"
              >
                <Trash2 className="h-3 w-3 text-zinc-400" />
              </button>
            )}
            <Link href="/console/history">
              <Button variant="ghost" size="sm" className="h-6 px-2 text-[10px]">
                Full History
              </Button>
            </Link>
          </div>
        </div>

        {/* Notifications list */}
        <div className="max-h-64 overflow-y-auto">
          {notifications.length === 0 ? (
            <div className="px-3 py-6 text-center">
              <History className="h-5 w-5 text-zinc-300 dark:text-zinc-600 mx-auto mb-2" />
              <p className="text-xs text-zinc-400 dark:text-zinc-500">No recent activity</p>
            </div>
          ) : (
            <div className="p-1.5 space-y-1 group">
              {notifications.map((notification) => (
                <NotificationItem key={notification.id} notification={notification} />
              ))}
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
