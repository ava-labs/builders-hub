import { describe, expect, it, vi } from 'vitest';
import { createElement, isValidElement, type ReactElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { Accordion } from 'fumadocs-ui/components/accordion';

// Each question row's quiz echoes the props the chapter list gives it.
vi.mock('@/components/quizzes/quiz', () => ({
  default: ({ quizId, showPosition }: { quizId: string; showPosition?: boolean }) =>
    createElement('output', { 'data-quiz': quizId, 'data-show-position': String(showPosition) }),
}));

import {
  CertificateChapters,
  CertificateProgress,
  ChapterHeading,
  QuestionTitle,
} from '@/components/quizzes/certificate-progress';

const PRODUCTION_COLOUR = /(?:gray|green|red|amber|orange|yellow)-\d|\bbg-muted\b/;
// Any element other than an icon hidden from screen readers (the status text must stay readable).
const HIDDEN_NON_ICON = /<(?!svg\b)[a-z]+\b[^>]*\baria-hidden="true"/;

describe('CertificateProgress', () => {
  it("puts production's two lines in one card with a red bar at the completed share", () => {
    const html = renderToStaticMarkup(createElement(CertificateProgress, { completed: 5, total: 14 }));
    expect(html).toContain('Complete all quizzes to get your certificate.');
    expect(html).toContain('5 of 14 quizzes completed.');
    expect(html).toContain('lucide-award');
    expect(html).toContain('bg-ac-red');
    expect(html).toContain('style="width:35.714285714285715%"');
    expect(html).toContain('rounded-xl border border-ac-rule bg-ac-paper');
    expect(html).not.toMatch(PRODUCTION_COLOUR);
  });

  it('draws an empty bar for a course without quizzes', () => {
    const html = renderToStaticMarkup(createElement(CertificateProgress, { completed: 0, total: 0 }));
    expect(html).toContain('0 of 0 quizzes completed.');
    expect(html).toContain('style="width:0%"');
  });

  it('keeps the card out of the prose paragraph margins, so its lines sit as the approved box has them', () => {
    const html = renderToStaticMarkup(createElement(CertificateProgress, { completed: 5, total: 14 }));
    expect(html).toMatch(/^<div class="not-prose /);
  });

  it('tightens the card on phone', () => {
    const html = renderToStaticMarkup(createElement(CertificateProgress, { completed: 1, total: 2 }));
    expect(html).toContain('max-md:px-3.5');
    expect(html).toContain('max-md:mb-7');
  });
});

describe('ChapterHeading', () => {
  it('carries the chapter count, with a check in ok once the chapter is complete', () => {
    const html = renderToStaticMarkup(
      createElement(ChapterHeading, { chapter: 'Primer on Avalanche Consensus', completed: 5, total: 5 }),
    );
    expect(html.startsWith('<h3')).toBe(true);
    expect(html).toContain('Primer on Avalanche Consensus');
    expect(html).toContain('5 of 5');
    expect(html).toContain('text-ac-ok');
    expect(html).toContain('lucide-check');
    expect(html).toContain('font-ac-display');
  });

  it('shows an open chapter count in the secondary grey without a check', () => {
    const html = renderToStaticMarkup(
      createElement(ChapterHeading, { chapter: 'Multi-Chain Architecture', completed: 0, total: 3 }),
    );
    expect(html).toContain('0 of 3');
    expect(html).toContain('text-ac-ink-3');
    expect(html).not.toContain('lucide-check');
  });
});

describe('QuestionTitle', () => {
  it('marks a correctly answered question with a check on ok', () => {
    const html = renderToStaticMarkup(
      createElement(QuestionTitle, { question: 'What is a Double Spending Attack?', answered: true }),
    );
    expect(html).toContain('bg-ac-ok');
    expect(html).toContain('lucide-check');
    expect(html).toContain('<span>What is a Double Spending Attack?</span>');
    // D6: the mark tells screen readers its status.
    expect(html).toContain('<span class="sr-only">Answered correctly</span>');
    expect(html).not.toContain('Not answered yet');
    expect(html).not.toMatch(HIDDEN_NON_ICON);
  });

  it('marks an open question with an empty ring', () => {
    const html = renderToStaticMarkup(
      createElement(QuestionTitle, { question: "What's the P-Chain's main purpose?", answered: false }),
    );
    expect(html).toContain('border-ac-ink-3');
    expect(html).not.toContain('lucide-check');
    expect(html).not.toContain('bg-ac-ok');
    // D6: the empty ring tells screen readers its status.
    expect(html).toContain('<span class="sr-only">Not answered yet</span>');
    expect(html).not.toContain('Answered correctly');
    expect(html).not.toMatch(HIDDEN_NON_ICON);
  });

  it('uses Academy tokens only', () => {
    [true, false].forEach((answered) => {
      expect(renderToStaticMarkup(createElement(QuestionTitle, { question: 'Q', answered }))).not.toMatch(
        PRODUCTION_COLOUR,
      );
    });
  });
});

describe('CertificateChapters', () => {
  const props = {
    chapters: ['Primer on Avalanche Consensus', 'Multi-Chain Architecture'],
    quizzesByChapter: {
      'Primer on Avalanche Consensus': [
        { id: '101', question: 'What is a Double Spending Attack?' },
        { id: '102', question: 'What is a Consensus Mechanism?' },
      ],
      'Multi-Chain Architecture': [{ id: '201', question: "What's the P-Chain's main purpose?" }],
    },
    completedQuizzes: ['101'],
    onQuizCompleted: () => undefined,
  };
  /** Every question row in an element tree. */
  const rowsIn = (node: ReactNode): ReactElement<{ children?: ReactNode }>[] => {
    if (Array.isArray(node)) return node.flatMap(rowsIn);
    if (!isValidElement<{ children?: ReactNode }>(node)) return [];
    return node.type === Accordion ? [node] : rowsIn(node.props.children);
  };

  it('gives every question row its own accordion value, its quiz id, so each row opens alone', () => {
    const html = renderToStaticMarkup(createElement(CertificateChapters, props));
    const values = [...html.matchAll(/data-accordion-value="([^"]*)"/g)].map(([, value]) => value);
    expect(values).toEqual(['101', '102', '201']);
  });

  it('turns off the question position on every quiz, as each row renders it once opened', () => {
    // A closed row renders no content on the server, so each row's content is rendered on its own.
    const opened = rowsIn(CertificateChapters(props)).map((row) => renderToStaticMarkup(row.props.children));
    expect(opened).toEqual(
      ['101', '102', '201'].map((id) => `<output data-quiz="${id}" data-show-position="false"></output>`),
    );
  });
});
