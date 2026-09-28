/** A vertical extent in pixels, both edges in one coordinate space (for example getBoundingClientRect). */
export interface Span {
  top: number;
  bottom: number;
}

/** A scroll container's scroll state; an HTMLElement satisfies it. */
export interface ScrollState {
  scrollTop: number;
  scrollHeight: number;
  clientHeight: number;
}

/** True when `item` lies entirely inside `view`, less an `inset` band at the top and at the bottom. */
export function isFullyVisible(item: Span, view: Span, inset = 0): boolean {
  return item.top >= view.top + inset && item.bottom <= view.bottom - inset;
}

/**
 * The scrollTop that puts the centre of `item` on the centre of the container, clamped to the
 * container's scroll range. `view` is the container's box (it has no border), measured together with
 * `item` and with `scroll`, so the result does not depend on where the list was scrolled to.
 */
export function centredScrollTop(item: Span, view: Span, scroll: ScrollState): number {
  const itemTop = scroll.scrollTop + item.top - view.top;
  const target = itemTop + (item.bottom - item.top) / 2 - scroll.clientHeight / 2;
  const max = Math.max(0, scroll.scrollHeight - scroll.clientHeight);
  return Math.min(Math.max(target, 0), max);
}
