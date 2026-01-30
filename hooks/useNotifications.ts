"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { toast } from "sonner";
import { parseError, type ParsedError } from "@/lib/error-parser";

export type NotificationType = "success" | "error" | "warning" | "info";

export interface NotificationAction {
  label: string;
  onClick: () => void;
}

export interface Notification {
  id: string;
  title: string;
  description?: string;
  type: NotificationType;
  timestamp: number;
  read: boolean;
  action?: NotificationAction;
  link?: string;
  persistent?: boolean; // If true, shown in notification center
}

export interface NotificationOptions {
  title: string;
  description?: string;
  type?: NotificationType;
  action?: NotificationAction;
  link?: string;
  duration?: number; // Auto-dismiss duration in ms, 0 = no auto-dismiss
  persistent?: boolean; // If true, saved to notification center
}

interface NotificationStore {
  notifications: Notification[];
  unreadCount: number;
  addNotification: (notification: Omit<Notification, "id" | "timestamp" | "read">) => string;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  removeNotification: (id: string) => void;
  clearAll: () => void;
}

// Generate unique IDs
const generateId = () => `notif_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

// Maximum notifications to keep in store
const MAX_NOTIFICATIONS = 50;

export const useNotificationStore = create<NotificationStore>()(
  persist(
    (set, get) => ({
      notifications: [],
      unreadCount: 0,

      addNotification: (notification) => {
        const id = generateId();
        const newNotification: Notification = {
          ...notification,
          id,
          timestamp: Date.now(),
          read: false,
        };

        set((state) => {
          // Keep only the most recent notifications
          const notifications = [newNotification, ...state.notifications].slice(0, MAX_NOTIFICATIONS);
          const unreadCount = notifications.filter((n) => !n.read).length;
          return { notifications, unreadCount };
        });

        return id;
      },

      markAsRead: (id) => {
        set((state) => {
          const notifications = state.notifications.map((n) =>
            n.id === id ? { ...n, read: true } : n
          );
          const unreadCount = notifications.filter((n) => !n.read).length;
          return { notifications, unreadCount };
        });
      },

      markAllAsRead: () => {
        set((state) => ({
          notifications: state.notifications.map((n) => ({ ...n, read: true })),
          unreadCount: 0,
        }));
      },

      removeNotification: (id) => {
        set((state) => {
          const notifications = state.notifications.filter((n) => n.id !== id);
          const unreadCount = notifications.filter((n) => !n.read).length;
          return { notifications, unreadCount };
        });
      },

      clearAll: () => {
        set({ notifications: [], unreadCount: 0 });
      },
    }),
    {
      name: "console-notifications",
      partialize: (state) => ({
        // Only persist persistent notifications
        notifications: state.notifications.filter((n) => n.persistent),
        unreadCount: state.notifications.filter((n) => n.persistent && !n.read).length,
      }),
    }
  )
);

/**
 * Hook for showing notifications with both toast and notification center support
 */
export function useNotifications() {
  const store = useNotificationStore();

  /**
   * Show a notification toast and optionally add to notification center
   */
  const notify = (options: NotificationOptions): string => {
    const { title, description, type = "info", action, link, duration, persistent = true } = options;

    // Create toast with appropriate style
    const toastOptions = {
      description,
      duration: duration ?? (type === "error" ? 8000 : 5000),
      action: action
        ? {
            label: action.label,
            onClick: action.onClick,
          }
        : undefined,
    };

    // Show toast based on type
    switch (type) {
      case "success":
        toast.success(title, toastOptions);
        break;
      case "error":
        toast.error(title, toastOptions);
        break;
      case "warning":
        toast.warning(title, toastOptions);
        break;
      case "info":
      default:
        toast.info(title, toastOptions);
        break;
    }

    // Add to notification center if persistent
    if (persistent) {
      return store.addNotification({
        title,
        description,
        type,
        action,
        link,
        persistent,
      });
    }

    return "";
  };

  /**
   * Show a success notification
   */
  const success = (title: string, description?: string, options?: Partial<NotificationOptions>) => {
    return notify({ title, description, type: "success", ...options });
  };

  /**
   * Show an error notification with smart parsing
   */
  const error = (errorOrTitle: unknown | string, description?: string, options?: Partial<NotificationOptions>) => {
    // If it's a string title with description, use as-is
    if (typeof errorOrTitle === "string" && description) {
      return notify({ title: errorOrTitle, description, type: "error", ...options });
    }

    // Otherwise, parse the error
    const parsed: ParsedError = typeof errorOrTitle === "string"
      ? { title: errorOrTitle, description: description || "", severity: "error" }
      : parseError(errorOrTitle);

    return notify({
      title: parsed.title,
      description: parsed.description,
      type: "error",
      link: parsed.link,
      ...options,
    });
  };

  /**
   * Show a warning notification
   */
  const warning = (title: string, description?: string, options?: Partial<NotificationOptions>) => {
    return notify({ title, description, type: "warning", ...options });
  };

  /**
   * Show an info notification
   */
  const info = (title: string, description?: string, options?: Partial<NotificationOptions>) => {
    return notify({ title, description, type: "info", ...options });
  };

  /**
   * Show a promise-based notification (loading -> success/error)
   */
  const promise = <T,>(
    promiseOrFn: Promise<T> | (() => Promise<T>),
    messages: {
      loading: string;
      success: string | ((data: T) => string);
      error: string | ((err: unknown) => string);
    },
    options?: Partial<NotificationOptions>
  ): Promise<T> => {
    const toastPromise = typeof promiseOrFn === "function" ? promiseOrFn() : promiseOrFn;

    toast.promise(toastPromise, {
      loading: messages.loading,
      success: (data) => {
        const message = typeof messages.success === "function" ? messages.success(data) : messages.success;
        // Add to notification center on success
        if (options?.persistent !== false) {
          store.addNotification({
            title: message,
            type: "success",
            persistent: true,
          });
        }
        return message;
      },
      error: (err) => {
        const message = typeof messages.error === "function" ? messages.error(err) : messages.error;
        const parsed = parseError(err);
        // Add to notification center on error
        if (options?.persistent !== false) {
          store.addNotification({
            title: parsed.title,
            description: parsed.description,
            type: "error",
            link: parsed.link,
            persistent: true,
          });
        }
        return `${parsed.title}: ${parsed.description}`;
      },
    });

    return toastPromise;
  };

  return {
    // Core methods
    notify,
    success,
    error,
    warning,
    info,
    promise,

    // Store access
    notifications: store.notifications,
    unreadCount: store.unreadCount,
    markAsRead: store.markAsRead,
    markAllAsRead: store.markAllAsRead,
    removeNotification: store.removeNotification,
    clearAll: store.clearAll,
  };
}
