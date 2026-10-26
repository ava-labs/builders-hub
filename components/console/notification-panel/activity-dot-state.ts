import type { ConsoleNotification } from './store';

/** What the dot on the Activity button shows. */
export type ActivityDotState = 'idle' | 'busy' | 'success' | 'failure';

type Item = Pick<ConsoleNotification, 'status' | 'timestamp' | 'resolvedAt'>;

/** When an item's result landed: when it left 'loading', or when it was added for one that was added finished. */
const landedAt = (item: Item): number => item.resolvedAt ?? item.timestamp;

/**
 * con-activity-dot: the dot for the panel's transactions. Busy while any one still runs. Otherwise the result that
 * landed last decides, so a failure that lands after a success shows red even when the failed transaction started
 * first. Idle when the list is empty. Two results that land in the same millisecond: the newer transaction decides
 * (the store keeps the list newest first).
 */
export function activityDotState(items: ReadonlyArray<Item>): ActivityDotState {
  if (items.some((item) => item.status === 'loading')) return 'busy';
  const last = items.reduce<Item | undefined>(
    (latest, item) => (!latest || landedAt(item) > landedAt(latest) ? item : latest),
    undefined,
  );
  if (!last) return 'idle';
  return last.status === 'error' ? 'failure' : 'success';
}

/** When the newest result in the list landed: the latest resolvedAt, or 0 while none has. */
export function newestLanding(items: ReadonlyArray<Item>): number {
  return items.reduce((newest, item) => Math.max(newest, item.resolvedAt ?? 0), 0);
}

/**
 * A result just landed: the list holds a resolvedAt newer than `seen`, the newest landing the dot has seen, and the dot
 * shows a result, not busy. The dot sends its one ring only then. Removing the last running row takes the dot from busy
 * to an older result, but nothing landed, so it does not ring. Returns the newest landing seen after this list too.
 */
export function landedResult(seen: number, items: ReadonlyArray<Item>): { landed: boolean; seen: number } {
  const newest = newestLanding(items);
  const dot = activityDotState(items);
  return { landed: newest > seen && (dot === 'success' || dot === 'failure'), seen: Math.max(seen, newest) };
}
