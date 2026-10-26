import { describe, expect, it } from 'vitest';
import { nextPlacement, type Placement } from '@/components/console/onboarding-tour/placement';
import { CONSOLE_TOUR_STEPS } from '@/components/console/onboarding-tour/types';

/**
 * con-tour-glide: what moves the welcome tour's spotlight and card (components/console/onboarding-tour/placement.ts,
 * used for every placement update in onboarding-tour/index.tsx).
 */
const [sidebar, search] = CONSOLE_TOUR_STEPS;
const rect = (x: number, y: number) => ({ x, y, left: x, top: y, width: 100, height: 40 }) as DOMRect;

describe('nextPlacement', () => {
  it('places the first stop at once and travels to each later stop', () => {
    const first = nextPlacement(null, { kind: 'stop', step: sidebar, rect: rect(0, 56) });
    expect(first).toMatchObject({ step: sidebar, glide: false });
    const second = nextPlacement(first, { kind: 'stop', step: search, rect: rect(900, 64) });
    expect(second).toMatchObject({ step: search, glide: true });
  });

  it('places a scroll, a resize or the settle after a scroll into view at once', () => {
    const first = nextPlacement(null, { kind: 'stop', step: sidebar, rect: rect(0, 56) });
    const moving = nextPlacement(first, { kind: 'stop', step: search, rect: rect(900, 64) });
    expect(nextPlacement(moving, { kind: 'track', step: search, rect: rect(900, 40) })).toMatchObject({
      step: search,
      glide: false,
    });
  });

  it('forgets its place when the tour closes, so a restart places its first stop at once', () => {
    const first = nextPlacement(null, { kind: 'stop', step: sidebar, rect: rect(0, 56) });
    const last = nextPlacement(first, { kind: 'stop', step: search, rect: rect(900, 64) });
    const closed = nextPlacement(last, { kind: 'close' });
    expect(closed).toBeNull();
    const restarted: Placement | null = nextPlacement(closed, { kind: 'stop', step: sidebar, rect: rect(0, 56) });
    expect(restarted).toMatchObject({ step: sidebar, glide: false });
  });

  it('keeps the measured step with its rect, so the card keeps that step side and padding until the next one', () => {
    const r = rect(10, 20);
    expect(nextPlacement(null, { kind: 'stop', step: search, rect: r })).toEqual({
      step: search,
      rect: r,
      glide: false,
    });
  });
});
