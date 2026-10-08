import { afterEach, describe, expect, it, vi } from 'vitest';

const STORAGE_KEY = 'console-onboarding-tour';

function memoryStorage(entries: Record<string, string> = {}): Storage {
  const m = new Map(Object.entries(entries));
  return {
    get length() {
      return m.size;
    },
    clear: () => m.clear(),
    getItem: (k) => m.get(k) ?? null,
    key: (i) => [...m.keys()][i] ?? null,
    removeItem: (k) => void m.delete(k),
    setItem: (k, v) => void m.set(k, String(v)),
  };
}

// The store reads localStorage when its module loads, so each test loads a new copy.
async function loadStore(entries?: Record<string, string>) {
  vi.stubGlobal('localStorage', memoryStorage(entries));
  vi.resetModules();
  const { useOnboardingTour } = await import('@/hooks/useOnboardingTour');
  return useOnboardingTour;
}

describe('useOnboardingTour persistence', () => {
  afterEach(() => vi.unstubAllGlobals());

  // The welcome dialog opens only after hydration (welcome-modal.tsx).
  it('hydrates for a new visitor, who has not seen the welcome dialog', async () => {
    const store = await loadStore();
    expect(store.persist.hasHydrated()).toBe(true);
    expect(store.getState().hasSeenWelcome).toBe(false);
    expect(store.getState().hasCompletedTour).toBe(false);
  });

  it('loads the answer of a returning visitor', async () => {
    const saved = JSON.stringify({ state: { hasSeenWelcome: true, hasCompletedTour: true }, version: 0 });
    const store = await loadStore({ [STORAGE_KEY]: saved });
    expect(store.persist.hasHydrated()).toBe(true);
    expect(store.getState().hasSeenWelcome).toBe(true);
    expect(store.getState().hasCompletedTour).toBe(true);
  });

  it('saves a skipped welcome dialog for the next visit', async () => {
    const store = await loadStore();
    store.getState().endTour();
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!).state).toEqual({
      hasSeenWelcome: true,
      hasCompletedTour: true,
    });
  });
});
