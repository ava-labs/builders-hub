import { describe, expect, it } from 'vitest';
import {
  fromLegacyItem,
  findLegacyCourse,
  legacySetToDeck,
  parseLegacyData,
} from '@/lib/flashcards/legacy';
import type { LegacyFlashcardData } from '@/lib/flashcards/types';

const DATA: LegacyFlashcardData = {
  courses: {
    'codebase-entrepreneur-academy': {
      title: 'Entrepreneur Academy',
      flashcardSets: ['legal-foundations', 'sales-mastery'],
    },
  },
  flashcardSets: {
    'legal-foundations': [
      {
        term: 'Legal Jurisdiction',
        definition: 'Where your business is registered.',
        example: 'A Delaware C-Corp answers to Delaware law.',
      },
      { term: 'Howey Test', definition: 'SEC investment-contract test.' },
    ],
    'sales-mastery': [],
  },
};

describe('fromLegacyItem', () => {
  const source = { kind: 'academy' as const, path: '/x', chapterTitle: 'X' };

  it('copies term -> front and definition -> back', () => {
    const item = DATA.flashcardSets['legal-foundations'][1];
    const card = fromLegacyItem(item, source);
    expect(card.type).toBe('qa');
    expect(card.front).toBe('Howey Test');
    expect(card.back).toBe('SEC investment-contract test.');
  });

  it('appends the example block onto back when present', () => {
    const item = DATA.flashcardSets['legal-foundations'][0];
    const card = fromLegacyItem(item, source);
    expect(card.back).toContain('Where your business is registered.');
    expect(card.back).toContain('*Example:*');
    expect(card.back).toContain('Delaware');
  });

  it('assigns a fresh id every call', () => {
    const item = DATA.flashcardSets['legal-foundations'][1];
    const a = fromLegacyItem(item, source);
    const b = fromLegacyItem(item, source);
    expect(a.id).not.toBe(b.id);
  });
});

describe('findLegacyCourse', () => {
  it('returns the parent course for a known set id', () => {
    const result = findLegacyCourse(DATA, 'legal-foundations');
    expect(result).toEqual({ key: 'codebase-entrepreneur-academy', title: 'Entrepreneur Academy' });
  });

  it('returns null for an orphan set id', () => {
    expect(findLegacyCourse(DATA, 'nonexistent')).toBeNull();
  });
});

describe('legacySetToDeck', () => {
  it('returns null when the set id is unknown', () => {
    expect(legacySetToDeck(DATA, 'nope')).toBeNull();
  });

  it('returns null when the set is empty (would fail Deck min(1))', () => {
    expect(legacySetToDeck(DATA, 'sales-mastery')).toBeNull();
  });

  it('produces a deck with cards in original order and a labeled title', () => {
    const deck = legacySetToDeck(DATA, 'legal-foundations');
    expect(deck).not.toBeNull();
    if (!deck) return;
    expect(deck.cards).toHaveLength(2);
    expect(deck.cards[0].front).toBe('Legal Jurisdiction');
    expect(deck.title).toContain('Entrepreneur Academy');
    expect(deck.title).toContain('Legal Foundations');
  });
});

describe('parseLegacyData', () => {
  it('validates the data shape via Zod', () => {
    expect(() => parseLegacyData(DATA)).not.toThrow();
  });

  it('throws on malformed input', () => {
    expect(() => parseLegacyData({ courses: {}, flashcardSets: { bad: [{ term: '' }] } })).toThrow();
  });
});
