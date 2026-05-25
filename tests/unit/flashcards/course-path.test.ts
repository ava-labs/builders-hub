import { describe, expect, it } from 'vitest';
import { courseRootFromPath } from '@/lib/flashcards/course-path';

describe('courseRootFromPath', () => {
  it('returns the course root for a chapter URL', () => {
    expect(
      courseRootFromPath('/academy/avalanche-l1/avalanche-fundamentals/01-welcome'),
    ).toBe('/academy/avalanche-l1/avalanche-fundamentals');
  });

  it('returns the course root for a deep chapter URL', () => {
    expect(
      courseRootFromPath(
        '/academy/blockchain/blockchain-fundamentals/02-what-is-a-blockchain/03-decentralized-applications',
      ),
    ).toBe('/academy/blockchain/blockchain-fundamentals');
  });

  it('returns itself when given the exact course root', () => {
    expect(courseRootFromPath('/academy/avalanche-l1/avalanche-fundamentals')).toBe(
      '/academy/avalanche-l1/avalanche-fundamentals',
    );
  });

  it('tolerates a trailing slash', () => {
    expect(courseRootFromPath('/academy/avalanche-l1/avalanche-fundamentals/')).toBe(
      '/academy/avalanche-l1/avalanche-fundamentals',
    );
  });

  it('returns null for paths shallower than category/course', () => {
    expect(courseRootFromPath('/academy/avalanche-l1')).toBeNull();
    expect(courseRootFromPath('/academy')).toBeNull();
  });

  it('returns null for docs and other non-academy paths', () => {
    expect(courseRootFromPath('/docs/cross-chain/icm/overview')).toBeNull();
    expect(courseRootFromPath('/console/something')).toBeNull();
    expect(courseRootFromPath('')).toBeNull();
    expect(courseRootFromPath('/')).toBeNull();
  });
});
