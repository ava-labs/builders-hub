import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  QUIZ_BUTTON_CLASS,
  QuizFeedback,
  QuizOption,
  optionState,
  type OptionState,
} from '@/components/quizzes/quiz-question';

type Extra = { marker?: string; multiple?: boolean; locked?: boolean; checked?: boolean };
const option = (state: OptionState, extra: Extra = {}) =>
  renderToStaticMarkup(
    createElement(QuizOption, {
      state,
      marker: extra.marker ?? 'B',
      multiple: extra.multiple ?? false,
      locked: extra.locked ?? false,
      name: 'quiz-102',
      checked: extra.checked ?? false,
      onSelect: () => undefined,
      children: 'An α-majority of sampled validators',
    }),
  );
const PRODUCTION_COLOUR = /(?:gray|green|red|amber|orange|neutral)-\d|\bbg-white\b|avax-/;

describe('optionState', () => {
  const flags = { selected: false, correct: false, checked: false, locked: false };

  it('is idle or selected before the answer is checked', () => {
    expect(optionState(flags)).toBe('idle');
    expect(optionState({ ...flags, selected: true })).toBe('selected');
  });

  it('marks the selected rows correct or wrong after the check and dims the others', () => {
    expect(optionState({ ...flags, checked: true, selected: true, correct: true })).toBe('correct');
    expect(optionState({ ...flags, checked: true, selected: true })).toBe('wrong');
    expect(optionState({ ...flags, checked: true, correct: true })).toBe('dimmed');
    expect(optionState({ ...flags, checked: true })).toBe('dimmed');
  });

  it('dims the unchecked rows of a locked quiz and keeps its checked answer visible', () => {
    expect(optionState({ ...flags, locked: true, selected: true })).toBe('dimmed');
    expect(optionState({ ...flags, locked: true, checked: true, selected: true })).toBe('wrong');
  });
});

describe('QuizOption', () => {
  it('draws an idle option as a radio row with its letter in a ring', () => {
    const html = option('idle');
    expect(html).toContain('data-option-state="idle"');
    expect(html).toContain('rounded-full');
    expect(html).toContain('border-ac-rule-2');
    expect(html).toContain('>B</span>');
    expect(html).toContain('cursor-pointer');
    expect(html).toContain('An α-majority of sampled validators');
  });

  it('carries a native radio, or a checkbox on multiple-answer questions, and keeps the marker out of its name', () => {
    const html = option('selected', { checked: true });
    expect(html).toMatch(/<label [^>]*data-option-state="selected"/);
    expect(html).toMatch(/<input type="radio" [^>]*name="quiz-102" [^>]*checked=""/);
    expect(html).toContain('<span aria-hidden="true"');
    expect(option('idle', { multiple: true, marker: '' })).toContain('type="checkbox"');
    expect(option('dimmed', { locked: true })).toContain('disabled=""');
  });

  it('rings the selected row in ink', () => {
    const html = option('selected');
    expect(html).toContain('border-ac-ink bg-ac-paper shadow-[0_0_0_1px_var(--ac-ink)]');
    expect(html).toContain('bg-ac-ink text-ac-paper');
  });

  it('rings and tints the correct row in ok, with a check in place of the letter', () => {
    const html = option('correct');
    expect(html).toContain('bg-ac-ok-bg');
    expect(html).toContain('shadow-[0_0_0_1px_var(--ac-ok)]');
    expect(html).toContain('lucide-check');
    expect(html).not.toContain('>B</span>');
  });

  it('dims the other rows by colour, never by opacity', () => {
    const html = option('dimmed');
    expect(html).toContain('text-ac-ink-3');
    expect(html).not.toContain('opacity');
  });

  it("keeps production's square marker on multiple-answer questions", () => {
    const html = option('idle', { multiple: true, marker: '' });
    expect(html).toContain('rounded-md');
    expect(html).not.toContain('rounded-full');
  });

  it('shows a not-allowed cursor on a locked quiz', () => {
    const html = option('dimmed', { locked: true });
    expect(html).toContain('cursor-not-allowed');
    expect(html).not.toContain('cursor-pointer');
  });

  it('uses Academy tokens only, in every state', () => {
    (['idle', 'selected', 'correct', 'wrong', 'dimmed'] as const).forEach((state) => {
      expect(option(state)).not.toMatch(PRODUCTION_COLOUR);
    });
  });
});

describe('QuizFeedback', () => {
  it('shows the explanation on the panel with a lightbulb and the label in ok', () => {
    const html = renderToStaticMarkup(
      createElement(QuizFeedback, { correct: true, children: 'Avalanche consensus dictates' }),
    );
    expect(html).toContain('bg-ac-panel');
    expect(html).toContain('lucide-lightbulb');
    expect(html).toContain('text-ac-ok">Correct</span>');
    expect(html).toContain('Avalanche consensus dictates');
  });

  it('labels a wrong answer in ink', () => {
    const html = renderToStaticMarkup(createElement(QuizFeedback, { correct: false, children: 'The hint' }));
    expect(html).toContain('text-ac-ink">Not Quite</span>');
  });

  it('clears the prose paragraph margins, which outrank a plain m-0 in the utilities layer', () => {
    const html = renderToStaticMarkup(
      createElement(QuizFeedback, { correct: true, children: 'Avalanche consensus dictates' }),
    );
    expect(html).toContain('<p class="m-0! ');
  });
});

describe('QUIZ_BUTTON_CLASS', () => {
  it('is ink, and a grey tile when disabled instead of half opacity', () => {
    expect(QUIZ_BUTTON_CLASS).toContain('bg-ac-ink');
    expect(QUIZ_BUTTON_CLASS).toContain('text-ac-paper!');
    expect(QUIZ_BUTTON_CLASS).toContain('disabled:bg-ac-tile');
    expect(QUIZ_BUTTON_CLASS).toContain('disabled:opacity-100');
    expect(QUIZ_BUTTON_CLASS).not.toContain('disabled:opacity-50');
    expect(QUIZ_BUTTON_CLASS).not.toContain('bg-primary');
  });

  it('rings keyboard focus in ink outside the button, in place of the translucent shadcn ring', () => {
    expect(QUIZ_BUTTON_CLASS).toContain('focus-visible:outline-solid');
    expect(QUIZ_BUTTON_CLASS).toContain('focus-visible:outline-2');
    expect(QUIZ_BUTTON_CLASS).toContain('focus-visible:outline-offset-2');
    expect(QUIZ_BUTTON_CLASS).toContain('focus-visible:outline-ac-ink');
    expect(QUIZ_BUTTON_CLASS).toContain('focus-visible:ring-0');
    expect(QUIZ_BUTTON_CLASS).not.toContain('focus-visible:ring-[3px]');
  });
});
