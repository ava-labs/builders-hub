import { create } from 'zustand';

export interface ConsoleBadgeNotification {
  name: string;
  tier: string;
  description: string;
  imagePath: string;
  requirementDescription: string;
}

interface ConsoleBadgeNotificationState {
  pendingBadges: ConsoleBadgeNotification[];
  addBadges: (badges: ConsoleBadgeNotification[]) => void;
  dismissAll: () => void;
}

export const useConsoleBadgeNotificationStore = create<ConsoleBadgeNotificationState>((set) => ({
  pendingBadges: [],
  addBadges: (badges) => {
    if (!badges || badges.length === 0) return;
    set((state) => ({ pendingBadges: [...state.pendingBadges, ...badges] }));
  },
  dismissAll: () => set({ pendingBadges: [] }),
}));
