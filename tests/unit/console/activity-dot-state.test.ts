import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  activityDotState,
  landedResult,
  newestLanding,
} from '@/components/console/notification-panel/activity-dot-state';
import { useNotificationPanelStore } from '@/components/console/notification-panel/store';

/**
 * con-activity-dot: the dot on the console's Activity button. The store keeps its notifications newest first
 * (components/console/notification-panel/store.ts, addNotification), a running transaction has status 'loading', and
 * updateNotification stamps `resolvedAt` when a status leaves 'loading'.
 */
type Status = 'loading' | 'success' | 'error';
const item = (status: Status, timestamp: number, resolvedAt?: number) => ({ status, timestamp, resolvedAt });

afterEach(() => {
  vi.useRealTimers();
  useNotificationPanelStore.setState({ notifications: [], isOpen: false });
});

describe('activityDotState', () => {
  it('is idle with nothing in the list', () => {
    expect(activityDotState([])).toBe('idle');
  });

  it('is busy while any transaction still runs, wherever it sits in the list', () => {
    expect(activityDotState([item('loading', 1)])).toBe('busy');
    expect(activityDotState([item('success', 2, 3), item('loading', 1)])).toBe('busy');
    expect(activityDotState([item('loading', 2), item('error', 1, 3)])).toBe('busy');
  });

  // Production turns the dot green whenever nothing is loading (ConsoleNotificationPanel.tsx:100-102), so a failed
  // transaction reads as a success.
  it('is a failure when the last result to land failed', () => {
    expect(activityDotState([item('error', 1, 2)])).toBe('failure');
    expect(activityDotState([item('error', 3, 4), item('success', 1, 2)])).toBe('failure');
  });

  it('is a success when the last result to land succeeded', () => {
    expect(activityDotState([item('success', 1, 2)])).toBe('success');
    expect(activityDotState([item('success', 3, 4), item('error', 1, 2)])).toBe('success');
  });

  // Two transactions overlap: the list is newest first, but the older one lands last.
  it('follows the result that landed last, not the transaction that started last', () => {
    // both loading; the newer succeeds at 3000; the older fails last, at 4000
    expect(activityDotState([item('success', 2000, 3000), item('error', 1000, 4000)])).toBe('failure');
    // the mirror: the newer fails at 3000; the older succeeds last, at 4000
    expect(activityDotState([item('error', 2000, 3000), item('success', 1000, 4000)])).toBe('success');
  });

  it('falls back to the creation time for an item added already finished', () => {
    expect(activityDotState([item('error', 2000), item('success', 1000)])).toBe('failure');
    expect(activityDotState([item('success', 2000), item('error', 1000)])).toBe('success');
    // added finished at 5000, after the other result landed at 4000
    expect(activityDotState([item('error', 5000), item('success', 1000, 4000)])).toBe('failure');
  });

  it('lets the newer transaction decide when two results land in the same millisecond', () => {
    expect(activityDotState([item('error', 2000, 3000), item('success', 1000, 3000)])).toBe('failure');
  });
});

describe('the panel store stamps when a result lands', () => {
  const store = () => useNotificationPanelStore.getState();

  it('both loading; the newer succeeds; the older fails last: the dot is a failure', () => {
    vi.useFakeTimers();
    vi.setSystemTime(1000);
    const older = store().addNotification({ name: 'Chain Created', status: 'loading', message: 'Signing...' });
    vi.setSystemTime(2000);
    const newer = store().addNotification({ name: 'Validator Registered', status: 'loading', message: 'Signing...' });
    expect(activityDotState(store().notifications)).toBe('busy');
    vi.setSystemTime(3000);
    store().updateNotification(newer, { status: 'success', message: 'Done' });
    expect(activityDotState(store().notifications)).toBe('busy');
    vi.setSystemTime(4000);
    store().updateNotification(older, { status: 'error', message: 'Transaction Dropped' });
    expect(activityDotState(store().notifications)).toBe('failure');
  });

  it('the mirror: the newer fails, the older succeeds last: the dot is a success', () => {
    vi.useFakeTimers();
    vi.setSystemTime(1000);
    const older = store().addNotification({ name: 'Chain Created', status: 'loading', message: 'Signing...' });
    vi.setSystemTime(2000);
    const newer = store().addNotification({ name: 'Validator Registered', status: 'loading', message: 'Signing...' });
    vi.setSystemTime(3000);
    store().updateNotification(newer, { status: 'error', message: 'Transaction Dropped' });
    vi.setSystemTime(4000);
    store().updateNotification(older, { status: 'success', message: 'Done' });
    expect(activityDotState(store().notifications)).toBe('success');
  });

  it('stamps only the update that leaves loading; callers never pass the time', () => {
    vi.useFakeTimers();
    vi.setSystemTime(1000);
    const id = store().addNotification({ name: 'Chain Created', status: 'loading', message: 'Signing...' });
    vi.setSystemTime(1500);
    store().updateNotification(id, { message: 'Waiting for transaction confirmation...' });
    expect(store().notifications[0].resolvedAt).toBeUndefined();
    vi.setSystemTime(2000);
    store().updateNotification(id, { status: 'success', message: 'Done' });
    expect(store().notifications[0].resolvedAt).toBe(2000);
    vi.setSystemTime(2500);
    store().updateNotification(id, { message: 'Done, again' });
    expect(store().notifications[0].resolvedAt).toBe(2000);
  });
});

describe('landedResult: the one ring plays only when a result lands', () => {
  type Item = ReturnType<typeof item>;
  /** The dot over the list after each change, as the panel runs it: which changes ring. */
  const rings = (first: Item[], ...changes: Item[][]): boolean[] => {
    let seen = newestLanding(first);
    return changes.map((items) => {
      const after = landedResult(seen, items);
      seen = after.seen;
      return after.landed;
    });
  };

  it('rings when the last running transaction lands, a success or a failure', () => {
    expect(rings([item('loading', 1)], [item('success', 1, 2)])).toEqual([true]);
    expect(rings([item('loading', 1)], [item('error', 1, 2)])).toEqual([true]);
  });

  // The panel's remove button on the running row: the dot leaves busy for the older result, but nothing landed.
  it('does not ring when the last running row is removed and an earlier result shows again', () => {
    const earlier = item('success', 1, 2);
    expect(rings([item('loading', 3), earlier], [earlier])).toEqual([false]);
    const failed = item('error', 1, 2);
    expect(rings([item('loading', 3), failed], [failed])).toEqual([false]);
  });

  it('two transactions overlap: no ring while the other still runs, one ring when the last one lands', () => {
    const newer = item('success', 2, 3);
    expect(
      rings([item('loading', 2), item('loading', 1)], [newer, item('loading', 1)], [newer, item('error', 1, 4)]),
    ).toEqual([false, true]);
  });

  it('a result that landed while another ran does not ring later, when the running row is removed', () => {
    const newer = item('success', 2, 3);
    expect(rings([item('loading', 2), item('loading', 1)], [newer, item('loading', 1)], [newer])).toEqual([
      false,
      false,
    ]);
  });

  it('removing a result or clearing the list never rings', () => {
    const older = item('success', 1, 2);
    const newer = item('error', 3, 4);
    expect(rings([newer, older], [older], [])).toEqual([false, false]);
  });

  it('a result in the list when the dot first draws does not ring, and the next one to land does', () => {
    const earlier = item('error', 1, 2);
    expect(rings([earlier], [earlier], [item('loading', 5), earlier], [item('success', 5, 6), earlier])).toEqual([
      false,
      false,
      true,
    ]);
  });

  it('an item added already finished has no landing of its own, so it does not ring', () => {
    expect(rings([], [item('success', 1)])).toEqual([false]);
    expect(newestLanding([item('success', 1), item('error', 2)])).toBe(0);
  });
});
