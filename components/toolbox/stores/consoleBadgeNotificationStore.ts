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
  isRetroactive: boolean;
  addBadges: (badges: ConsoleBadgeNotification[], isRetroactive?: boolean) => void;
  dismissAll: () => void;
}

export const useConsoleBadgeNotificationStore = create<ConsoleBadgeNotificationState>((set) => ({
  pendingBadges: [],
  isRetroactive: false,
  addBadges: (badges, isRetroactive = false) => {
    if (!badges || badges.length === 0) return;
    set((state) => ({
      pendingBadges: [...state.pendingBadges, ...badges],
      isRetroactive: state.pendingBadges.length === 0 ? isRetroactive : state.isRetroactive,
    }));
  },
  dismissAll: () => set({ pendingBadges: [], isRetroactive: false }),
}));
