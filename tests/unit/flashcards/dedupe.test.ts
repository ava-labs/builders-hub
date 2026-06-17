import { describe, expect, it, vi, beforeEach } from 'vitest';
import { cosineSimilarity, dedupeFlashcards } from '@/lib/flashcards/dedupe';
import type { Flashcard } from '@/lib/flashcards/types';

// Stub the embedding module: return deterministic vectors keyed by the input text.
// Cards with identical front strings collapse to the same vector → cosine 1.0.
vi.mock('@/lib/embeddings', () => ({
  embedQuery: async (text: string): Promise<number[]> => {
    let hash = 0;
    for (let i = 0; i < text.length; i++) hash = (hash * 31 + text.charCodeAt(i)) >>> 0;
    return [(hash & 0xff) / 255, ((hash >>> 8) & 0xff) / 255, ((hash >>> 16) & 0xff) / 255, 1];
  },
}));

const baseSource = {
  kind: 'academy' as const,
  path: '/academy/x/y',
  chapterTitle: 'Y',
};

function makeCard(id: string, front: string, type: Flashcard['type'] = 'qa'): Flashcard {
  return { id, type, front, back: 'back text', source: baseSource };
}

describe('cosineSimilarity', () => {
  it('returns 1 for identical vectors', () => {
    expect(cosineSimilarity([1, 0, 0], [1, 0, 0])).toBe(1);
  });

  it('returns 0 for orthogonal vectors', () => {
    expect(cosineSimilarity([1, 0], [0, 1])).toBe(0);
  });

  it('throws when dimensions disagree', () => {
    expect(() => cosineSimilarity([1, 0], [1, 0, 0])).toThrow();
  });

  it('handles zero-magnitude vectors safely', () => {
    expect(cosineSimilarity([0, 0], [1, 0])).toBe(0);
  });
});

describe('dedupeFlashcards', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns the input unchanged when fewer than 2 cards', async () => {
    const cards: Flashcard[] = [makeCard('1', 'Solo')];
    const result = await dedupeFlashcards(cards);
    expect(result.kept).toHaveLength(1);
    expect(result.droppedIds).toEqual([]);
  });

  it('keeps the first occurrence when fronts collide', async () => {
    const cards: Flashcard[] = [
      makeCard('1', 'What is Snowman?'),
      makeCard('2', 'What is Snowman?'),
      makeCard('3', 'Different question entirely about validators'),
    ];
    const result = await dedupeFlashcards(cards, 0.99);
    expect(result.kept.map((c) => c.id)).toEqual(['1', '3']);
    expect(result.droppedIds).toEqual(['2']);
  });

  it('respects the threshold parameter', async () => {
    const cards: Flashcard[] = [
      makeCard('1', 'Slightly different prompt one'),
      makeCard('2', 'Wildly different second question'),
    ];
    const lax = await dedupeFlashcards(cards, 0.0);
    expect(lax.kept).toHaveLength(1);

    const strict = await dedupeFlashcards(cards, 1.01);
    expect(strict.kept).toHaveLength(2);
  });
});
