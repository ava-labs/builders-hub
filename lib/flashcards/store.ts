'use client';

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { Deck, Flashcard } from './types';

interface StudioState {
  sessionId: string | null;
  deck: Deck | null;
  /** Card ids the user soft-rejected. Excluded from visibleCards() and from the .apkg download. */
  rejectedIds: string[];
  /** Card ids currently being regenerated (spinner state). */
  regeneratingIds: string[];
  isGenerating: boolean;
  error: string | null;
}

interface StudioActions {
  setSession(sessionId: string, deck: Deck): void;
  startGenerating(): void;
  setError(error: string | null): void;
  rejectCard(cardId: string): void;
  acceptCard(cardId: string): void;
  replaceCard(oldId: string, newCard: Flashcard): void;
  startRegenerating(cardId: string): void;
  endRegenerating(cardId: string): void;
  reset(): void;
}

type StudioStore = StudioState & StudioActions;

const initialState: StudioState = {
  sessionId: null,
  deck: null,
  rejectedIds: [],
  regeneratingIds: [],
  isGenerating: false,
  error: null,
};

export const useStudioStore = create<StudioStore>()(
  persist(
    (set) => ({
      ...initialState,

      setSession: (sessionId, deck) =>
        set({
          sessionId,
          deck,
          rejectedIds: [],
          regeneratingIds: [],
          isGenerating: false,
          error: null,
        }),

      startGenerating: () => set({ isGenerating: true, error: null }),

      setError: (error) => set({ isGenerating: false, error }),

      rejectCard: (cardId) =>
        set((state) => ({
          rejectedIds: state.rejectedIds.includes(cardId)
            ? state.rejectedIds
            : [...state.rejectedIds, cardId],
        })),

      acceptCard: (cardId) =>
        set((state) => ({
          rejectedIds: state.rejectedIds.filter((id) => id !== cardId),
        })),

      replaceCard: (oldId, newCard) =>
        set((state) => {
          if (!state.deck) return state;
          return {
            deck: {
              ...state.deck,
              cards: state.deck.cards.map((c) => (c.id === oldId ? newCard : c)),
            },
            rejectedIds: state.rejectedIds.filter((id) => id !== oldId),
            regeneratingIds: state.regeneratingIds.filter((id) => id !== oldId),
          };
        }),

      startRegenerating: (cardId) =>
        set((state) => ({
          regeneratingIds: state.regeneratingIds.includes(cardId)
            ? state.regeneratingIds
            : [...state.regeneratingIds, cardId],
        })),

      endRegenerating: (cardId) =>
        set((state) => ({
          regeneratingIds: state.regeneratingIds.filter((id) => id !== cardId),
        })),

      reset: () => set(initialState),
    }),
    {
      name: 'avalanche-flashcards-studio',
      storage: createJSONStorage(() => sessionStorage),
      partialize: (state) => ({
        sessionId: state.sessionId,
        deck: state.deck,
        rejectedIds: state.rejectedIds,
      }),
    },
  ),
);

export function selectVisibleCards(state: StudioStore): Flashcard[] {
  if (!state.deck) return [];
  return state.deck.cards.filter((c) => !state.rejectedIds.includes(c.id));
}
