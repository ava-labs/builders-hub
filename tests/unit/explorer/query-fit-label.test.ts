import { describe, expect, it } from 'vitest';

import { fitLabel, stackLabels } from '@/components/explorer-v2/evm/query/fit-text';

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

describe("a chart's red line names", () => {
  // the reported chart: weekly marks about 55 px apart, three names at the last three
  const peak = { x: 1410, w: 60 };
  const basePeak = { x: 1465, w: 84 };
  const latest = { x: 1520, w: 102 };

  it('stay on one row when they keep apart', () => {
    expect(stackLabels([{ x: 200, w: 60 }, { x: 600, w: 60 }], 1550)).toEqual([
      { left: 170, row: 0 },
      { left: 570, row: 0 },
    ]);
  });

  it('stack on rows when names a few marks apart would cover each other', () => {
    const spots = stackLabels([peak, basePeak, latest], 1550);
    expect(spots.map((s) => s.row)).toEqual([0, 1, 2]);
  });

  it('never cover each other on a row, in any order and at any spacing', () => {
    for (const step of [10, 30, 55, 90, 200]) {
      const marks = [latest, peak, basePeak, { x: 900, w: 168 }].map((m, i) => ({ x: 300 + ((i * step) % 1200), w: m.w }));
      const spots = stackLabels(marks, 1550);
      spots.forEach((a, i) =>
        spots.forEach((b, j) => {
          if (i === j || a.row !== b.row) return;
          expect(a.left + marks[i].w <= b.left || b.left + marks[j].w <= a.left).toBe(true);
        }),
      );
    }
  });

  it('take the lowest free row, so a name past a stack drops back to the first', () => {
    const spots = stackLabels([peak, basePeak, { x: 1300, w: 36 }], 1550);
    expect(spots.map((s) => s.row)).toEqual([0, 1, 0]);
  });
});
