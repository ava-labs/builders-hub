import type { CSSProperties } from 'react';
import type { StepDefinition } from '@/components/console/step-flow';

type BranchOption = Extract<StepDefinition, { type: 'branch' }>['options'][number];

/** Where a step key sits in a flow: its step, and for a branch step the option the key names. */
export type StepPosition = { index: number; step?: StepDefinition; option?: BranchOption };

/** Finds `key` in `steps`: a single step's key, or the key of one option of a branch step. Index -1 when neither. */
export function locateStep(steps: StepDefinition[], key: string): StepPosition {
  const single = steps.findIndex((s) => s.type === 'single' && s.key === key);
  if (single !== -1) return { index: single, step: steps[single] };
  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];
    if (step.type !== 'branch') continue;
    const option = step.options.find((o) => o.key === key);
    if (option) return { index: i, step, option };
  }
  return { index: -1 };
}

/**
 * The step bar's red mark over segment `index` of `count` (con-step-travel). The segments share the row with 0.25rem
 * gaps, so the mark is one segment wide and moves by whole segments with transform only: a CSS transition carries it
 * and retargets it when the step changes again mid-way.
 */
export function markStyle(index: number, count: number): CSSProperties {
  return {
    width: `calc((100% - ${count - 1} * 0.25rem) / ${count})`,
    transform: `translateX(calc(${index} * (100% + 0.25rem)))`,
  };
}

/**
 * The step the completion modal is open on, once the flow shows `step`: `openOn` while the flow stays on it, else null
 * (closed). StepFlow outlives its steps, so a step change, such as the browser's Back after Finish, closes the modal,
 * and a return to that step does not open it again. Closing this way does not finish the flow.
 */
export function completionOn(openOn: string | null, step: string): string | null {
  return openOn === step ? openOn : null;
}
