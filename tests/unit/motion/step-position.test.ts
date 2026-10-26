import { describe, expect, it } from 'vitest';
import type { StepDefinition } from '@/components/console/step-flow';
import { completionOn, locateStep, markStyle } from '@/components/console/step-position';

const Empty = () => null;

const STEPS: StepDefinition[] = [
  { type: 'single', key: 'create-subnet', title: 'Create Subnet', component: Empty },
  { type: 'single', key: 'create-chain', title: 'Create Chain', component: Empty },
  {
    type: 'branch',
    key: 'node-setup',
    title: 'Set Up a Node',
    options: [
      { key: 'managed-testnet-l1-nodes', label: 'Managed Testnet L1 Nodes', component: Empty },
      { key: 'l1-node-setup', label: 'L1 Node Setup with Docker', component: Empty },
    ],
  },
  { type: 'single', key: 'convert-to-l1', title: 'Convert to L1', component: Empty },
];

describe('locateStep', () => {
  it('finds a single step by its key', () => {
    const at = locateStep(STEPS, 'create-chain');
    expect(at.index).toBe(1);
    expect(at.step).toBe(STEPS[1]);
    expect(at.option).toBeUndefined();
  });

  it('finds a branch step by the key of one of its options', () => {
    const at = locateStep(STEPS, 'l1-node-setup');
    expect(at.index).toBe(2);
    expect(at.step).toBe(STEPS[2]);
    expect(at.option?.label).toBe('L1 Node Setup with Docker');
  });

  it('does not match a branch step by its own key: the URL names one of its options', () => {
    expect(locateStep(STEPS, 'node-setup')).toEqual({ index: -1 });
  });

  it('returns index -1 for a key the flow does not have', () => {
    expect(locateStep(STEPS, 'nope')).toEqual({ index: -1 });
    expect(locateStep([], 'create-subnet')).toEqual({ index: -1 });
  });
});

describe('markStyle', () => {
  it('is one segment wide: the row splits its width between the steps, less the 0.25rem gaps', () => {
    expect(markStyle(0, 4).width).toBe('calc((100% - 3 * 0.25rem) / 4)');
    expect(markStyle(0, 1).width).toBe('calc((100% - 0 * 0.25rem) / 1)');
  });

  it('moves by whole segments with transform only, so a CSS transition can carry it and retarget it', () => {
    expect(markStyle(0, 4).transform).toBe('translateX(calc(0 * (100% + 0.25rem)))');
    expect(markStyle(2, 4).transform).toBe('translateX(calc(2 * (100% + 0.25rem)))');
    expect(Object.keys(markStyle(3, 4)).sort()).toEqual(['transform', 'width']);
  });
});

/* The flow stays mounted from step to step (step-flow-route.tsx), so the completion modal's state lives through a step
   change. Each render asks completionOn which step the modal is open on; null is closed. */
describe('completionOn', () => {
  it('keeps the modal open on the step where the flow finished', () => {
    expect(completionOn('convert-to-l1', 'convert-to-l1')).toBe('convert-to-l1');
  });

  it('closes it when the flow shows another step, as the browser Back does after Finish', () => {
    expect(completionOn('convert-to-l1', 'create-chain')).toBeNull();
  });

  it('does not open it again on a return to that step (the browser Forward)', () => {
    // Back closed it, so the render on return starts from null
    const back = completionOn('convert-to-l1', 'create-chain');
    expect(completionOn(back, 'convert-to-l1')).toBeNull();
  });

  it('never opens it by itself', () => {
    expect(completionOn(null, 'create-subnet')).toBeNull();
  });
});
