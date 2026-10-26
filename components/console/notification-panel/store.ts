import { create } from 'zustand';

export type NotificationStatus = 'loading' | 'success' | 'error';

export interface ConsoleNotification {
  id: string;
  name: string;
  status: NotificationStatus;
  message: string;
  txHash?: string;
  explorerUrl?: string;
  timestamp: number;
  /** When the status left 'loading' (set by updateNotification), so the Activity dot follows the last result. */
  resolvedAt?: number;
}

/** `n` with `update` applied. Leaving 'loading' stamps the time the result landed. */
function applyUpdate(n: ConsoleNotification, update: Partial<ConsoleNotification>): ConsoleNotification {
  const resolves = n.status === 'loading' && update.status !== undefined && update.status !== 'loading';
  return resolves ? { ...n, ...update, resolvedAt: Date.now() } : { ...n, ...update };
}

interface NotificationPanelStore {
  notifications: ConsoleNotification[];
  isOpen: boolean;
  setOpen: (open: boolean) => void;
  addNotification: (notification: Omit<ConsoleNotification, 'id' | 'timestamp'>) => string;
  updateNotification: (id: string, update: Partial<ConsoleNotification>) => void;
  removeNotification: (id: string) => void;
  clearAll: () => void;
}

let counter = 0;

export const useNotificationPanelStore = create<NotificationPanelStore>((set) => ({
  notifications: [],
  isOpen: false,
  setOpen: (open) => set({ isOpen: open }),
  addNotification: (notification) => {
    const id = `notif-${++counter}-${Date.now()}`;
    set((state) => ({
      notifications: [{ ...notification, id, timestamp: Date.now() }, ...state.notifications].slice(0, 20),
      isOpen: true,
    }));
    return id;
  },
  updateNotification: (id, update) => {
    set((state) => ({
      notifications: state.notifications.map((n) => (n.id === id ? applyUpdate(n, update) : n)),
    }));
  },
  removeNotification: (id) => {
    set((state) => ({
      notifications: state.notifications.filter((n) => n.id !== id),
    }));
  },
  clearAll: () => set({ notifications: [] }),
}));
