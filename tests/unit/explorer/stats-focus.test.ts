import { describe, expect, it } from 'vitest';

import { focusHandOff } from '@/components/explorer-v2/network/NetworkStats';

/* exp-range-hold: a copy of Network Stats that leaves goes inert, and the browser would drop the focus inside it on
   the page. focusHandOff picks the control that takes it over: the one at the same place in the copy that arrives.
   Controls stand in for DOM elements, in tab order. */
const LINK = { name: 'ICM chart link' };
const SENT = { name: 'Sent' };
const RECEIVED = { name: 'Received' };
const NEW_LINK = { name: 'ICM chart link, new window' };
const NEW_SENT = { name: 'Sent, new window' };
const NEW_RECEIVED = { name: 'Received, new window' };

describe('focusHandOff', () => {
  it('focus in the copy that leaves moves to the control at the same place in the copy that arrives', () => {
    const copies = [
      { leaving: true, controls: [LINK, SENT, RECEIVED] },
      { leaving: false, controls: [NEW_LINK, NEW_SENT, NEW_RECEIVED] },
    ];
    expect(focusHandOff(copies, LINK)).toBe(NEW_LINK);
    expect(focusHandOff(copies, SENT)).toBe(NEW_SENT);
    expect(focusHandOff(copies, RECEIVED)).toBe(NEW_RECEIVED);
  });

  it('finds the arriving copy wherever it sits among copies still leaving (rapid windows)', () => {
    const older = { name: 'Sent, older window' };
    const copies = [
      { leaving: true, controls: [{ name: 'link, older window' }, older] },
      { leaving: false, controls: [NEW_LINK, NEW_SENT] },
      { leaving: true, controls: [LINK, SENT] },
    ];
    expect(focusHandOff(copies, SENT)).toBe(NEW_SENT);
    expect(focusHandOff(copies, older)).toBe(NEW_SENT);
  });

  it('leaves focus alone when it is in the copy that stays, or in no copy', () => {
    const copies = [
      { leaving: true, controls: [LINK] },
      { leaving: false, controls: [NEW_LINK] },
    ];
    expect(focusHandOff(copies, NEW_LINK)).toBeNull();
    expect(focusHandOff(copies, { name: 'the range control' })).toBeNull();
  });

  it('has nowhere to go when the arriving copy has no control at that place', () => {
    // a chart with a link and two legend keys gives way to a chart with none
    const copies = [
      { leaving: true, controls: [LINK, SENT] },
      { leaving: false, controls: [] },
    ];
    expect(focusHandOff(copies, SENT)).toBeNull();
    // and no copy is arriving at all
    expect(focusHandOff([{ leaving: true, controls: [LINK] }], LINK)).toBeNull();
  });
});
