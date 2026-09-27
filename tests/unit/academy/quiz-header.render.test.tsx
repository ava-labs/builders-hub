import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import Quiz from '@/components/quizzes/quiz';
import { QuizHeader } from '@/components/quizzes/quiz-header';
import type { QuizPosition } from '@/components/quizzes/quiz-position';

const header = (position: QuizPosition | null) => renderToStaticMarkup(createElement(QuizHeader, { position }));
const occurrences = (html: string, token: string) => html.split(token).length - 1;
const PRODUCTION_COLOUR = /(?:gray|green|red|amber|orange|neutral)-\d|\bbg-white\b|avax-/;

describe('QuizHeader', () => {
  it('names the knowledge check beside the ink tile', () => {
    const html = header(null);
    expect(html).toContain('>Knowledge check</h4>');
    expect(html).toContain('lucide-list-checks');
    expect(html).toContain('bg-ac-tile text-ac-ink');
    expect(html).toContain('border-b border-ac-rule');
  });

  it('keeps the row out of the prose heading margins, so the label sits level with the tile', () => {
    expect(header(null)).toMatch(/^<div class="not-prose /);
  });

  it('shows no count while the position is unknown or the page has one quiz', () => {
    const html = header(null);
    expect(html).not.toContain('Question');
    expect(html).not.toContain('bg-ac-red');
  });

  it('shows the position with one segment per quiz, red up to the current one', () => {
    const html = header({ index: 2, count: 3 });
    expect(html).toContain('Question 2 of 3');
    expect(occurrences(html, 'bg-ac-red')).toBe(2);
    expect(occurrences(html, 'bg-ac-rule')).toBe(1);
    expect(html).toContain('aria-hidden="true"');
  });

  it('draws the segments on a page with 20 quizzes', () => {
    const html = header({ index: 7, count: 20 });
    expect(html).toContain('Question 7 of 20');
    expect(occurrences(html, 'bg-ac-red')).toBe(7);
    expect(occurrences(html, 'bg-ac-rule')).toBe(13);
    expect(occurrences(html, 'aria-hidden="true"')).toBe(2);
  });

  it('keeps the label on one line when a long page makes the segments shrink', () => {
    const labelClasses = (header({ index: 7, count: 20 }).match(/<h4 class="([^"]*)"/) ?? ['', ''])[1].split(' ');
    expect(labelClasses).toContain('shrink-0');
  });

  it('shows the count as text only above 20 quizzes, with no segments at any width', () => {
    const html = header({ index: 7, count: 21 });
    expect(html).toContain('Question 7 of 21');
    expect(html).not.toContain('bg-ac-red');
    expect(html).not.toContain('bg-ac-rule');
    expect(occurrences(html, 'aria-hidden="true"')).toBe(1);
  });

  it('moves the count under the label on phone', () => {
    const html = header({ index: 1, count: 2 });
    expect(html).toContain('max-md:basis-full');
    expect(html).toContain('max-md:pl-[38px]');
  });

  it('uses Academy tokens only', () => {
    expect(header({ index: 1, count: 2 })).not.toMatch(PRODUCTION_COLOUR);
  });
});

describe('Quiz server markup (Review Focus 2)', () => {
  it('renders the neutral placeholder with the root marker and no question count', () => {
    const html = renderToStaticMarkup(createElement(Quiz, { quizId: '104' }));
    expect(html).toBe('<div data-quiz-root="">Loading...</div>');
    expect(html).not.toContain('Question');
  });
});
