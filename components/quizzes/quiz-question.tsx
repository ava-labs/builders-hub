import type { ReactNode } from 'react';
import { Check, Lightbulb } from 'lucide-react';
import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/utils/cn';

export type OptionState = 'idle' | 'selected' | 'correct' | 'wrong' | 'dimmed';

export interface OptionFlags {
  selected: boolean;
  correct: boolean;
  checked: boolean;
  locked: boolean;
}

/**
 * Production's option states (quiz.tsx) with names: before the check a row is idle or selected;
 * after it a selected row is correct or wrong and every other row is dimmed. A locked quiz dims its
 * unchecked rows, which production drew at half opacity.
 */
export function optionState({ selected, correct, checked, locked }: OptionFlags): OptionState {
  if (checked) {
    if (!selected) return 'dimmed';
    return correct ? 'correct' : 'wrong';
  }
  if (locked) return 'dimmed';
  return selected ? 'selected' : 'idle';
}

// Rows are dimmed by colour, never by opacity. A wrong row keeps the selected row's ink ring outside
// its grey border.
const ROW: Record<OptionState, string> = {
  idle: 'border-ac-rule bg-ac-paper hover:border-ac-rule-2 hover:bg-ac-panel',
  selected: 'border-ac-ink bg-ac-paper shadow-[0_0_0_1px_var(--ac-ink)]',
  correct: 'border-ac-ok bg-ac-ok-bg shadow-[0_0_0_1px_var(--ac-ok)]',
  wrong: 'border-ac-ink-3 bg-ac-panel shadow-[0_0_0_1px_var(--ac-ink)]',
  dimmed: 'border-ac-rule bg-ac-paper',
};

// The correct marker's check draws in the ground colour: white in light and near black in dark.
const MARKER: Record<OptionState, string> = {
  idle: 'border-ac-rule-2 text-ac-ink-3',
  selected: 'border-ac-ink bg-ac-ink text-ac-paper',
  correct: 'border-ac-ok bg-ac-ok text-ac-ground',
  wrong: 'border-ac-ink-3 bg-ac-ink-3 text-ac-paper',
  dimmed: 'border-ac-rule text-ac-ink-3',
};

const TEXT: Record<OptionState, string> = {
  idle: 'text-ac-ink-2',
  selected: 'font-medium text-ac-ink-2',
  correct: 'font-medium text-ac-ink',
  wrong: 'text-ac-ink-2',
  dimmed: 'text-ac-ink-3',
};

export interface QuizOptionProps {
  state: OptionState;
  /** Production's marker text: the option letter, or on multiple-answer questions a check mark or nothing. */
  marker: string;
  /** Several correct answers: production's square marker instead of the ring. */
  multiple: boolean;
  locked: boolean;
  onSelect: () => void;
  children: ReactNode;
}

/** One option as a radio row (spec 4.7). The option text stays in the last span. */
export function QuizOption({ state, marker, multiple, locked, onSelect, children }: QuizOptionProps) {
  return (
    <div
      data-option-state={state}
      className={cn(
        'flex items-center rounded-[10px] border px-3.5 py-3',
        ROW[state],
        locked ? 'cursor-not-allowed' : 'cursor-pointer',
      )}
      onClick={onSelect}
    >
      <span
        className={cn(
          'mr-3 flex size-[22px] shrink-0 items-center justify-center border-[1.5px] font-ac-mono text-[11px] leading-[calc(1.25/0.875)]',
          multiple ? 'rounded-md' : 'rounded-full',
          MARKER[state],
        )}
      >
        {state === 'correct' ? <Check className="size-3" strokeWidth={3} aria-hidden="true" /> : marker}
      </span>
      <span className={cn('text-[14.5px] leading-[calc(1.25/0.875)]', TEXT[state])}>{children}</span>
    </div>
  );
}

/**
 * The explanation panel (spec 4.7): the lightbulb, production's "Correct" or "Not Quite" label, the text.
 * The text's margin carries !important: the prose paragraph rule sits later in the utilities layer
 * than m-0 and would add 1.25em above and below it.
 */
export function QuizFeedback({ correct, children }: { correct: boolean; children: ReactNode }) {
  return (
    <div className="mt-4 grid grid-cols-[18px_minmax(0,1fr)] gap-x-2.5 rounded-[10px] border border-ac-rule bg-ac-panel px-4 py-3.5">
      <Lightbulb className="row-span-2 mt-px size-[17px] text-ac-ink-3" aria-hidden="true" />
      <div className="mb-[3px] flex items-center">
        <span
          className={cn(
            'text-[13.5px] font-semibold leading-[calc(1.25/0.875)]',
            correct ? 'text-ac-ok' : 'text-ac-ink',
          )}
        >
          {correct ? 'Correct' : 'Not Quite'}
        </span>
      </div>
      <p className="m-0! text-[14px] leading-[1.6] text-ac-ink-2">{children}</p>
    </div>
  );
}

/**
 * Check Answer and Try Again: ink, and a grey tile when disabled instead of half opacity. The text
 * colours carry !important so no Academy stylesheet rule for buttons in the article recolours them.
 * Keyboard focus takes a 2 px ink ring outside the button in place of the translucent shadcn ring;
 * outline-solid restores the style that buttonVariants' outline-none clears.
 */
export const QUIZ_BUTTON_CLASS = cn(
  buttonVariants({ variant: 'default' }),
  'rounded-lg bg-ac-ink text-ac-paper! hover:bg-ac-ink/90 disabled:bg-ac-tile disabled:text-ac-ink-2! disabled:opacity-100',
  'focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ac-ink focus-visible:ring-0',
);
