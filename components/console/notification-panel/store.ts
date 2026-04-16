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
      notifications: state.notifications.map((n) => (n.id === id ? { ...n, ...update } : n)),
    }));
  },
  removeNotification: (id) => {
    set((state) => ({
      notifications: state.notifications.filter((n) => n.id !== id),
    }));
  },
  clearAll: () => set({ notifications: [] }),
}));
