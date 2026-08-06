import { describe, expect, it } from "vitest";
import { staleViewFigure } from "../../../components/epoched-view/data/figure";
import {
  estimateTextWidth,
  figureDesktop,
  figureMobile,
  figureTexts,
  rulerDesktop,
  rulerMobile,
  rulerTexts,
  seriesYAt,
  stairPoints,
  textFits,
  viewSeriesPoints,
  type FigureLayout,
  type RulerLayout,
  type Zone,
} from "../../../components/epoched-view/timeline-layouts";

const LAYOUTS: readonly FigureLayout[] = [figureDesktop, figureMobile];
const RULERS: readonly RulerLayout[] = [rulerDesktop, rulerMobile];

const rectsOverlap = (a: Zone, b: Zone): boolean =>
  a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

const inBounds = (z: Zone, layout: { viewBox: { w: number; h: number } }): boolean =>
  z.x >= 0 && z.y >= 0 && z.x + z.w <= layout.viewBox.w && z.y + z.h <= layout.viewBox.h;

describe("figure layout zones (the label-lane law)", () => {
  it("keeps every declared zone inside its viewBox", () => {
    for (const layout of LAYOUTS) {
      for (const z of Object.values(layout.zones)) {
        expect(inBounds(z, layout), `${layout.kind}:${z.id}`).toBe(true);
      }
    }
  });

  it("keeps every pair of declared zones disjoint", () => {
    for (const layout of LAYOUTS) {
      const zones = Object.values(layout.zones);
      for (let i = 0; i < zones.length; i += 1) {
        for (let j = i + 1; j < zones.length; j += 1) {
          expect(
            rectsOverlap(zones[i], zones[j]),
            `${layout.kind}: ${zones[i].id} overlaps ${zones[j].id}`,
          ).toBe(false);
        }
      }
    }
  });
});

describe("ruler layout zones (the label-lane law)", () => {
  it("keeps every declared zone inside its viewBox and pairwise disjoint", () => {
    for (const layout of RULERS) {
      const zones = Object.values(layout.zones);
      for (const z of zones) {
        expect(inBounds(z, layout), `${layout.kind}:${z.id}`).toBe(true);
      }
      for (let i = 0; i < zones.length; i += 1) {
        for (let j = i + 1; j < zones.length; j += 1) {
          expect(
            rectsOverlap(zones[i], zones[j]),
            `${layout.kind}: ${zones[i].id} overlaps ${zones[j].id}`,
          ).toBe(false);
        }
      }
    }
  });

  it("fits every ruler string in its zone", () => {
    for (const layout of RULERS) {
      for (const { text, zone } of rulerTexts(layout)) {
        expect(
          textFits(text, zone),
          `${layout.kind}: "${text}" (${Math.round(
            estimateTextWidth(text, zone.fontPx, zone.trackingEm),
          )}px) exceeds zone ${zone.id} (${zone.w - 8}px)`,
        ).toBe(true);
      }
    }
  });

  it("orders the marks epoch < tip < live inside the axis span", () => {
    for (const layout of RULERS) {
      const m = layout.marks;
      expect(m.epoch).toBeGreaterThan(layout.axisX0);
      expect(m.epoch).toBeLessThan(m.tip);
      expect(m.tip).toBeLessThan(m.live);
      expect(m.live).toBeLessThan(layout.axisX1);
    }
  });
});

describe("every rendered string fits its zone (round-2 review note)", () => {
  for (const layout of LAYOUTS) {
    it(`fits all figure texts on ${layout.kind}`, () => {
      for (const { text, zone } of figureTexts(layout, staleViewFigure)) {
        expect(
          textFits(text, zone),
          `${layout.kind}: "${text}" (${Math.round(
            estimateTextWidth(text, zone.fontPx, zone.trackingEm),
          )}px) exceeds zone ${zone.id} (${zone.w - 8}px)`,
        ).toBe(true);
      }
    });
  }
});

describe("figure data integrity", () => {
  const p = stairPoints(staleViewFigure.pchain.stair);
  const v = viewSeriesPoints(staleViewFigure.view);

  it("keeps both series and their marks inside normalized bounds", () => {
    for (const [x, y] of [...p, ...v]) {
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThanOrEqual(1);
      expect(y).toBeGreaterThan(0);
      expect(y).toBeLessThan(1);
    }
    const markXs = [
      ...staleViewFigure.view.blocks,
      ...(staleViewFigure.view.skips ?? []),
      staleViewFigure.dim.atX,
      staleViewFigure.pchain.registrationAt ?? 0,
    ];
    for (const x of markXs) {
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThanOrEqual(1);
    }
  });

  it("tiles [0, 1] with contiguous phases ending at 1", () => {
    let prev = 0;
    for (const phase of staleViewFigure.phases) {
      expect(phase.to).toBeGreaterThan(prev);
      prev = phase.to;
    }
    expect(prev).toBe(1);
    expect(staleViewFigure.phases).toHaveLength(3);
  });

  it("keeps the view at or behind the P-Chain everywhere (the legend's claim)", () => {
    for (let i = 0; i <= 100; i += 1) {
      const x = i / 100;
      expect(
        seriesYAt(v, x),
        `view above the P-Chain at x=${x}`,
      ).toBeLessThanOrEqual(seriesYAt(p, x) + 1e-9);
    }
  });
});
