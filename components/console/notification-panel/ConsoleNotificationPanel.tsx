'use client';

import { History, Check, X, Loader2, ExternalLink, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useNotificationPanelStore, type ConsoleNotification } from './store';
import Link from 'next/link';

function timeAgo(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  return `${Math.floor(seconds / 3600)}h ago`;
}

function NotificationItem({ notification }: { notification: ConsoleNotification }) {
  const { removeNotification } = useNotificationPanelStore();

  const statusIcon =
    notification.status === 'loading' ? (
      <Loader2 className="h-3.5 w-3.5 text-zinc-400 animate-spin shrink-0" />
    ) : notification.status === 'success' ? (
      <Check className="h-3.5 w-3.5 text-green-500 shrink-0" />
    ) : (
      <X className="h-3.5 w-3.5 text-red-500 shrink-0" />
    );

  const bgClass =
    notification.status === 'loading'
      ? 'bg-zinc-50 dark:bg-zinc-800/50'
      : notification.status === 'success'
        ? 'bg-green-50/50 dark:bg-green-900/10'
        : 'bg-red-50/50 dark:bg-red-900/10';

  return (
    <div className={`px-3 py-2 ${bgClass} rounded-lg transition-colors`}>
      <div className="flex items-start gap-2">
        <div className="mt-0.5">{statusIcon}</div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-medium text-zinc-900 dark:text-zinc-100 truncate">{notification.name}</span>
            <span className="text-[10px] text-zinc-400 shrink-0">{timeAgo(notification.timestamp)}</span>
          </div>
          <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5 line-clamp-2">{notification.message}</p>
          {notification.explorerUrl && notification.status === 'success' && (
            <a
              href={notification.explorerUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-[10px] text-blue-600 dark:text-blue-400 hover:underline mt-1"
            >
              View in Explorer <ExternalLink className="h-2.5 w-2.5" />
            </a>
          )}
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

export function ConsoleNotificationPanel() {
  const { notifications, isOpen, setOpen, clearAll } = useNotificationPanelStore();
  const hasActive = notifications.some((n) => n.status === 'loading');
  const hasNotifications = notifications.length > 0;

  return (
    <Popover open={isOpen} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" title="Transaction Activity" className="relative">
          <History className="h-4 w-4" />
          {hasActive && (
            <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-blue-500 animate-pulse" />
          )}
          {!hasActive && hasNotifications && (
            <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-green-500" />
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
