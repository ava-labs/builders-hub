import { describe, expect, it } from 'vitest';
import { findCourseByPath, type CategoryItem } from '@/lib/flashcards/catalog';

const FIXTURE: CategoryItem[] = [
  {
    slug: 'avalanche-l1',
    title: 'Avalanche L1 Academy',
    courses: [
      {
        slug: 'avalanche-fundamentals',
        title: 'Avalanche Fundamentals',
        chapters: [
          { path: '/academy/avalanche-l1/avalanche-fundamentals/01-welcome', title: 'Welcome', filePath: '' },
          { path: '/academy/avalanche-l1/avalanche-fundamentals/02-consensus', title: 'Consensus', filePath: '' },
        ],
      },
      {
        slug: 'permissioned-l1s',
        title: 'Permissioned L1s',
        chapters: [
          { path: '/academy/avalanche-l1/permissioned-l1s/01-intro', title: 'Intro', filePath: '' },
        ],
      },
    ],
  },
  {
    slug: 'blockchain',
    title: 'Blockchain Academy',
    courses: [
      {
        slug: 'blockchain-fundamentals',
        title: 'Blockchain Fundamentals',
        chapters: [
          { path: '/academy/blockchain/blockchain-fundamentals/01-history', title: 'History', filePath: '' },
        ],
      },
    ],
  },
];

describe('findCourseByPath', () => {
  it('matches an exact course root URL and returns the course + category context', () => {
    const result = findCourseByPath(FIXTURE, '/academy/avalanche-l1/avalanche-fundamentals');
    expect(result).not.toBeNull();
    expect(result?.course.slug).toBe('avalanche-fundamentals');
    expect(result?.course.chapters).toHaveLength(2);
    expect(result?.categorySlug).toBe('avalanche-l1');
    expect(result?.categoryTitle).toBe('Avalanche L1 Academy');
  });

  it('tolerates a trailing slash on the URL', () => {
    const result = findCourseByPath(FIXTURE, '/academy/avalanche-l1/avalanche-fundamentals/');
    expect(result?.course.slug).toBe('avalanche-fundamentals');
  });

  it('returns null for a chapter URL (deeper than the course root)', () => {
    const result = findCourseByPath(FIXTURE, '/academy/avalanche-l1/avalanche-fundamentals/01-welcome');
    expect(result).toBeNull();
  });

  it('returns null when the slug does not match any course', () => {
    expect(findCourseByPath(FIXTURE, '/academy/avalanche-l1/missing-course')).toBeNull();
  });

  it('returns null for a docs URL (course matching is academy-only)', () => {
    expect(findCourseByPath(FIXTURE, '/docs/cross-chain/icm/overview')).toBeNull();
  });

  it('finds courses across multiple categories', () => {
    const result = findCourseByPath(FIXTURE, '/academy/blockchain/blockchain-fundamentals');
    expect(result?.course.slug).toBe('blockchain-fundamentals');
    expect(result?.categorySlug).toBe('blockchain');
  });
});
