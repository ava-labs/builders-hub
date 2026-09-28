import { describe, expect, it } from 'vitest';
import { quizPosition, quizSegments } from '@/components/quizzes/quiz-position';

describe('quizPosition', () => {
  const roots = ['first', 'second', 'third'];

  it('numbers a quiz by its document order among the page quizzes', () => {
    expect(quizPosition(roots, 'first')).toEqual({ index: 1, count: 3 });
    expect(quizPosition(roots, 'third')).toEqual({ index: 3, count: 3 });
  });

  it('gives no position on a page with one quiz, so no "of 1" count shows', () => {
    expect(quizPosition(['only'], 'only')).toBeNull();
  });

  it('gives no position for a root that is not on the page', () => {
    expect(quizPosition(roots, 'missing')).toBeNull();
    expect(quizPosition([], 'missing')).toBeNull();
  });

  it('compares roots by identity, as it does DOM elements', () => {
    const a = { id: 'q' };
    const b = { id: 'q' };
    expect(quizPosition([a, b], b)).toEqual({ index: 2, count: 2 });
  });
});

describe('quizSegments', () => {
  it('turns on every segment up to and including the current quiz', () => {
    expect(quizSegments({ index: 1, count: 2 })).toEqual([true, false]);
    expect(quizSegments({ index: 2, count: 3 })).toEqual([true, true, false]);
    expect(quizSegments({ index: 3, count: 3 })).toEqual([true, true, true]);
  });

  it('draws one segment per quiz on a page with 20 quizzes', () => {
    const segments = quizSegments({ index: 7, count: 20 });
    expect(segments).toHaveLength(20);
    expect(segments.filter(Boolean)).toHaveLength(7);
  });

  it('draws no segments on a page with more than 20 quizzes, so the count shows as text only', () => {
    expect(quizSegments({ index: 7, count: 21 })).toEqual([]);
    expect(quizSegments({ index: 12, count: 41 })).toEqual([]);
  });
});
