import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

// Backing store for the mocked IndexedDB. Reset between tests.
const STORE = new Map<string, Map<string, unknown>>();

vi.mock('idb', () => ({
  openDB: vi.fn(async () => ({
    get: vi.fn(async (storeName: string, key: string) =>
      STORE.get(storeName)?.get(key),
    ),
    put: vi.fn(async (storeName: string, value: unknown, key: string) => {
      if (!STORE.has(storeName)) STORE.set(storeName, new Map());
      STORE.get(storeName)!.set(key, value);
    }),
    delete: vi.fn(async (storeName: string, key: string) => {
      STORE.get(storeName)?.delete(key);
    }),
  })),
}));

// Server-only branches return early on typeof window === 'undefined'; pretend
// we're in a browser so the helpers exercise the IDB path.
const originalWindow = (globalThis as { window?: unknown }).window;
beforeAll(() => {
  (globalThis as { window?: unknown }).window = {};
});
afterAll(() => {
  if (originalWindow === undefined) delete (globalThis as { window?: unknown }).window;
  else (globalThis as { window?: unknown }).window = originalWindow;
});

const { getCardRating, setCardRating, getDeckRatings, resetDeckRatings } = await import(
  '@/utils/quizzes/indexedDB'
);

beforeEach(() => {
  STORE.clear();
});

describe('flashcard ratings (IndexedDB helpers)', () => {
  it('returns undefined for an un-rated card', async () => {
    expect(await getCardRating('test-set', 0)).toBeUndefined();
  });

  it('persists a new rating with timesSeen=1', async () => {
    const rating = await setCardRating('test-set', 0, 'easy');
    expect(rating.status).toBe('easy');
    expect(rating.timesSeen).toBe(1);
    expect(rating.lastRatedAt).toBeGreaterThan(0);

    const loaded = await getCardRating('test-set', 0);
    expect(loaded?.status).toBe('easy');
    expect(loaded?.timesSeen).toBe(1);
  });

  it('increments timesSeen on subsequent rates and overwrites the status', async () => {
    await setCardRating('test-set', 5, 'unknown');
    await setCardRating('test-set', 5, 'hard');
    const out = await setCardRating('test-set', 5, 'easy');
    expect(out.status).toBe('easy');
    expect(out.timesSeen).toBe(3);
  });

  it('isolates ratings per setId + cardIndex', async () => {
    await setCardRating('deck-a', 0, 'easy');
    await setCardRating('deck-b', 0, 'hard');
    await setCardRating('deck-a', 1, 'unknown');

    expect((await getCardRating('deck-a', 0))?.status).toBe('easy');
    expect((await getCardRating('deck-b', 0))?.status).toBe('hard');
    expect((await getCardRating('deck-a', 1))?.status).toBe('unknown');
    expect(await getCardRating('deck-b', 1)).toBeUndefined();
  });

  it('getDeckRatings returns a sparse map keyed by card index', async () => {
    await setCardRating('deck-x', 0, 'easy');
    await setCardRating('deck-x', 2, 'hard');
    // index 1 is intentionally unrated

    const ratings = await getDeckRatings('deck-x', 4);
    expect(ratings[0]?.status).toBe('easy');
    expect(ratings[1]).toBeUndefined();
    expect(ratings[2]?.status).toBe('hard');
    expect(ratings[3]).toBeUndefined();
  });

  it('resetDeckRatings clears every card of a deck without touching others', async () => {
    await setCardRating('deck-keep', 0, 'easy');
    await setCardRating('deck-drop', 0, 'hard');
    await setCardRating('deck-drop', 1, 'unknown');

    await resetDeckRatings('deck-drop', 5);

    expect(await getCardRating('deck-drop', 0)).toBeUndefined();
    expect(await getCardRating('deck-drop', 1)).toBeUndefined();
    expect((await getCardRating('deck-keep', 0))?.status).toBe('easy');
  });
});
