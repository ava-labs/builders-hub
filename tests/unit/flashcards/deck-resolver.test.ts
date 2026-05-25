import { describe, expect, it, vi } from 'vitest';

vi.mock('@/components/flashcards/flashcardData.json', () => ({
  default: {
    courses: {
      'codebase-entrepreneur-academy': {
        title: 'Entrepreneur Academy',
        flashcardSets: ['legal-foundations', 'security-fundamentals'],
      },
      'blockchain-academy': {
        title: 'Blockchain Academy',
        flashcardSets: ['blockchain-fundamentals'],
      },
    },
    flashcardSets: {
      'legal-foundations': [
        { term: 'Howey Test', definition: 'A test for securities.' },
      ],
      'security-fundamentals': [
        { term: 'Access Management', definition: 'Controlling resource access.' },
      ],
      'blockchain-fundamentals': [
        { term: 'Block', definition: 'A bundle of transactions.' },
      ],
    },
  },
}));

const { getExistingDeckForCoursePath, getDeckSummary } = await import(
  '@/lib/flashcards/deck-resolver'
);

describe('getExistingDeckForCoursePath', () => {
  it('finds a numeric-prefixed section name (existing entrepreneur pattern)', () => {
    const out = getExistingDeckForCoursePath(
      '/academy/entrepreneur/foundations-web3-venture/01-legal-foundations/09-flashcards',
    );
    expect(out).not.toBeNull();
    expect(out?.setId).toBe('legal-foundations');
    expect(out?.cardCount).toBe(1);
    expect(out?.courseTitle).toBe('Entrepreneur Academy');
  });

  it('finds a course-root path (future pre-baked deck pattern)', () => {
    const out = getExistingDeckForCoursePath('/academy/blockchain/blockchain-fundamentals');
    expect(out?.setId).toBe('blockchain-fundamentals');
    expect(out?.courseTitle).toBe('Blockchain Academy');
  });

  it('prefers the deepest matching segment when multiple match', () => {
    const out = getExistingDeckForCoursePath(
      '/academy/blockchain/blockchain-fundamentals/01-history',
    );
    // "01-history" doesn't match anything; falls back to "blockchain-fundamentals" (the course)
    expect(out?.setId).toBe('blockchain-fundamentals');
  });

  it('returns null for an unknown course', () => {
    expect(
      getExistingDeckForCoursePath('/academy/avalanche-l1/avalanche-fundamentals'),
    ).toBeNull();
  });

  it('returns null for docs URLs', () => {
    expect(getExistingDeckForCoursePath('/docs/cross-chain/icm/overview')).toBeNull();
  });

  it('returns null for empty or malformed input', () => {
    expect(getExistingDeckForCoursePath('')).toBeNull();
    expect(getExistingDeckForCoursePath('/')).toBeNull();
    expect(getExistingDeckForCoursePath('academy/no-leading-slash')).toBeNull();
  });

  it('tolerates a trailing slash', () => {
    const out = getExistingDeckForCoursePath('/academy/blockchain/blockchain-fundamentals/');
    expect(out?.setId).toBe('blockchain-fundamentals');
  });
});

describe('getDeckSummary', () => {
  it('returns metadata for a known set id', () => {
    const out = getDeckSummary('security-fundamentals');
    expect(out).not.toBeNull();
    expect(out?.cardCount).toBe(1);
    expect(out?.courseTitle).toBe('Entrepreneur Academy');
  });

  it('returns null for an unknown set id', () => {
    expect(getDeckSummary('does-not-exist')).toBeNull();
  });
});
