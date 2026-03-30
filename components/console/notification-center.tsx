"use client";

import * as React from "react";
import Link from "next/link";
import { Bell, Check, CheckCheck, Trash2, X, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import {
  useNotificationStore,
  type Notification,
  type NotificationType,
} from "@/hooks/useNotifications";

// Type icons and colors
const typeStyles: Record<NotificationType, { color: string; bgColor: string }> = {
  success: {
    color: "text-green-500",
    bgColor: "bg-green-500/10",
  },
  error: {
    color: "text-red-500",
    bgColor: "bg-red-500/10",
  },
  warning: {
    color: "text-yellow-500",
    bgColor: "bg-yellow-500/10",
  },
  info: {
    color: "text-blue-500",
    bgColor: "bg-blue-500/10",
  },
};

// Format relative time
function formatRelativeTime(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;

  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (seconds < 60) {
    return "Just now";
  } else if (minutes < 60) {
    return `${minutes}m ago`;
  } else if (hours < 24) {
    return `${hours}h ago`;
  } else if (days < 7) {
    return `${days}d ago`;
  } else {
    return new Date(timestamp).toLocaleDateString();
  }
}

// Single notification item
function NotificationItem({
  notification,
  onMarkAsRead,
  onRemove,
}: {
  notification: Notification;
  onMarkAsRead: (id: string) => void;
  onRemove: (id: string) => void;
}) {
  const styles = typeStyles[notification.type];

  const handleClick = () => {
    if (!notification.read) {
      onMarkAsRead(notification.id);
    }
  };

  return (
    <div
      className={cn(
        "group relative flex gap-3 p-3 transition-colors hover:bg-muted/50",
        !notification.read && "bg-muted/30"
      )}
      onClick={handleClick}
    >
      {/* Type indicator */}
      <div className={cn("mt-0.5 h-2 w-2 shrink-0 rounded-full", styles.bgColor)}>
        <div className={cn("h-full w-full rounded-full", styles.color.replace("text-", "bg-"))} />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0 space-y-1">
        <div className="flex items-start justify-between gap-2">
          <p className={cn("text-sm font-medium leading-none", !notification.read && "font-semibold")}>
            {notification.title}
          </p>
          <span className="shrink-0 text-xs text-muted-foreground">
            {formatRelativeTime(notification.timestamp)}
          </span>
        </div>

        {notification.description && (
          <p className="text-sm text-muted-foreground line-clamp-2">
            {notification.description}
          </p>
        )}

        {/* Action buttons */}
        <div className="flex items-center gap-2 pt-1">
          {notification.action && (
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs"
              onClick={(e) => {
                e.stopPropagation();
                notification.action?.onClick();
              }}
            >
              {notification.action.label}
            </Button>
          )}

          {notification.link && (
            <Link href={notification.link} onClick={(e) => e.stopPropagation()}>
              <Button variant="ghost" size="sm" className="h-7 text-xs gap-1">
                View
                <ExternalLink className="h-3 w-3" />
              </Button>
            </Link>
          )}
        </div>
      </div>

      {/* Remove button */}
      <button
        className="absolute right-2 top-2 opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-muted"
        onClick={(e) => {
          e.stopPropagation();
          onRemove(notification.id);
        }}
        title="Remove notification"
      >
        <X className="h-3 w-3 text-muted-foreground" />
      </button>

      {/* Unread indicator */}
      {!notification.read && (
        <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-primary" />
      )}
    </div>
  );
}

// Empty state
function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-8 px-4 text-center">
      <div className="rounded-full bg-muted p-3 mb-3">
        <Bell className="h-6 w-6 text-muted-foreground" />
      </div>
      <p className="text-sm font-medium">No notifications</p>
      <p className="text-xs text-muted-foreground mt-1">
        You're all caught up! Notifications about your console actions will appear here.
      </p>
    </div>
  );
}

export function NotificationCenter() {
  const [isOpen, setIsOpen] = React.useState(false);
  const {
    notifications,
    unreadCount,
    markAsRead,
    markAllAsRead,
    removeNotification,
    clearAll,
  } = useNotificationStore();

  // Filter to only show persistent notifications
  const persistentNotifications = notifications.filter((n) => n.persistent !== false);

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative"
          title="Notifications"
        >
          <Bell className="h-4 w-4" />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-medium text-white">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>

      <PopoverContent
        className="w-80 p-0"
        align="end"
        sideOffset={8}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b p-3">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold">Notifications</h3>
            {unreadCount > 0 && (
              <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                {unreadCount} new
              </span>
            )}
          </div>

          {persistentNotifications.length > 0 && (
            <div className="flex items-center gap-1">
              {unreadCount > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs gap-1"
                  onClick={markAllAsRead}
                  title="Mark all as read"
                >
                  <CheckCheck className="h-3 w-3" />
                </Button>
              )}
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs gap-1 text-muted-foreground hover:text-destructive"
                onClick={clearAll}
                title="Clear all"
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          )}
        </div>

        {/* Notifications list */}
        {persistentNotifications.length === 0 ? (
          <EmptyState />
        ) : (
          <ScrollArea className="max-h-80">
            <div className="divide-y">
              {persistentNotifications.map((notification) => (
                <NotificationItem
                  key={notification.id}
                  notification={notification}
                  onMarkAsRead={markAsRead}
                  onRemove={removeNotification}
                />
              ))}
            </div>
          </ScrollArea>
        )}

        {/* Footer */}
        {persistentNotifications.length > 0 && (
          <>
            <Separator />
            <div className="p-2">
              <p className="text-center text-xs text-muted-foreground">
                Showing {persistentNotifications.length} notification{persistentNotifications.length !== 1 ? "s" : ""}
              </p>
            </div>
          </>
        )}
      </PopoverContent>
    </Popover>
  );
}
