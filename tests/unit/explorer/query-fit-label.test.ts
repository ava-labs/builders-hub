import { describe, expect, it } from 'vitest';

import { fitLabel } from '@/components/explorer-v2/evm/query/fit-text';

// A Query chart's words at an x (a marker's "so far", a band's name, an axis tick) stay whole inside the svg, which
// cuts what runs past its edge. Geist Mono at 10 px is 6 px a character: "so far" is 36 px wide.
const SO_FAR = 36;

describe('a label at an x', () => {
  it('stands centered over its x when it fits', () => {
    expect(fitLabel(500, SO_FAR, 1350)).toBe(482);
  });

  it('ends at its line over the last point of a line, which sits on the plot edge 12 px from the frame', () => {
    // centered, it ran 6 px past the frame and read "so fa"
    expect(fitLabel(1338, SO_FAR, 1350)).toBe(1302);
    expect(fitLabel(304, SO_FAR, 316)).toBe(268);
  });

  it('starts at its line near the left edge', () => {
    expect(fitLabel(10, 42, 316)).toBe(10);
  });

  it('starts at its x when set to, and moves left only as far as the frame needs', () => {
    expect(fitLabel(100, 138, 316, 'start')).toBe(100);
    expect(fitLabel(300, 138, 316, 'start')).toBe(176);
  });

  it('as a tick, stays centered and moves only as far as the frame needs', () => {
    // recharts spaced the ticks and moved the last one nearly inside: ending it at its x would put it over its neighbour
    expect(fitLabel(1300, 66, 1350, 'middle')).toBe(1267);
    expect(fitLabel(1320, 66, 1350, 'middle')).toBe(1282);
    expect(fitLabel(10, 30, 316, 'middle')).toBe(2);
  });

  it('starts at the frame when it is wider than the frame', () => {
    expect(fitLabel(100, 400, 316)).toBe(2);
  });

  it('never runs past either edge, at any x, when it fits the frame', () => {
    for (const frame of [189, 316, 647, 1350]) {
      for (const w of [30, 36, 126, 216].filter((n) => n <= frame - 4)) {
        for (let x = 0; x <= frame; x += 1) {
          for (const align of ['line', 'middle', 'start'] as const) {
            const left = fitLabel(x, w, frame, align);
            expect(left).toBeGreaterThanOrEqual(2);
            expect(left + w).toBeLessThanOrEqual(frame - 2);
          }
        }
      }
    }
  });
});
