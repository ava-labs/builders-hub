import type { FigureData, Stair, ViewSeries } from "./data/types";

/**
 * Label-lane law: every piece of text in the figure renders inside one of the
 * fixed rectangles declared here. Tests assert that zones are pairwise
 * disjoint, in-bounds, and that every string FITS its zone.
 */
export interface Zone {
  readonly id: string;
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
  /** Font size the renderer uses inside this zone. */
  readonly fontPx: number;
  /** Letter-spacing in em applied inside this zone (0 when none). */
  readonly trackingEm: number;
}

const zone = (
  id: string,
  x: number,
  y: number,
  w: number,
  h: number,
  fontPx: number,
  trackingEm = 0,
): Zone => ({ id, x, y, w, h, fontPx, trackingEm });

/** The minimal shape the coordinate mappers need. */
export interface PlotFrame {
  readonly plot: {
    readonly x0: number;
    readonly x1: number;
    readonly yTop: number;
    readonly yBot: number;
  };
}

export type FigureZoneId = "legend1" | "legend2" | "legend3" | "dimL" | "w1" | "w2" | "w3";

export interface FigureLayout extends PlotFrame {
  readonly kind: "desktop" | "mobile";
  readonly viewBox: { readonly w: number; readonly h: number };
  readonly axisY: number;
  readonly zones: Readonly<Record<FigureZoneId, Zone>>;
}

/* Round-3.2 stamped sheets: no gutters, the plot dominates; a three-row
   legend sits in the plot's empty upper-left corner. */
export const figureDesktop: FigureLayout = {
  kind: "desktop",
  viewBox: { w: 1000, h: 360 },
  plot: { x0: 28, x1: 972, yTop: 36, yBot: 296 },
  axisY: 316,
  zones: {
    legend1: zone("legend1", 36, 36, 300, 18, 11, 0.06),
    legend2: zone("legend2", 36, 56, 360, 18, 11, 0.06),
    legend3: zone("legend3", 36, 76, 320, 18, 10, 0.06),
    dimL: zone("dimL", 436, 166, 150, 20, 12, 0.04),
    w1: zone("w1", 72, 326, 120, 18, 11, 0.14),
    w2: zone("w2", 364, 326, 120, 18, 11, 0.14),
    w3: zone("w3", 732, 326, 120, 18, 11, 0.14),
  },
};

export const figureMobile: FigureLayout = {
  kind: "mobile",
  viewBox: { w: 480, h: 330 },
  plot: { x0: 14, x1: 466, yTop: 30, yBot: 262 },
  axisY: 282,
  zones: {
    legend1: zone("legend1", 18, 34, 240, 16, 9.5, 0.06),
    legend2: zone("legend2", 18, 52, 300, 16, 9.5, 0.06),
    legend3: zone("legend3", 18, 70, 264, 14, 8.5, 0.06),
    dimL: zone("dimL", 214, 146, 80, 16, 10, 0.04),
    w1: zone("w1", 24, 296, 80, 14, 9.5, 0.12),
    w2: zone("w2", 164, 296, 80, 14, 9.5, 0.12),
    w3: zone("w3", 340, 296, 80, 14, 9.5, 0.12),
  },
};

/* ------------------------------------------------------------------ */
/* Coordinate mapping and series geometry (shared by figure and tests) */
/* ------------------------------------------------------------------ */

export const mapX = (frame: PlotFrame, nx: number): number =>
  frame.plot.x0 + nx * (frame.plot.x1 - frame.plot.x0);

export const mapY = (frame: PlotFrame, ny: number): number =>
  frame.plot.yBot - ny * (frame.plot.yBot - frame.plot.yTop);

export type Point = readonly [number, number];

/** Rising staircase as normalized points (verbatim shape from the board). */
export function stairPoints(stair: Stair): Point[] {
  const pts: Point[] = [[stair.x0, stair.y0]];
  for (let i = 1; i <= stair.steps; i += 1) {
    const xs = stair.x0 + (stair.x1 - stair.x0) * (i / stair.steps);
    const ys = stair.y0 + (stair.y1 - stair.y0) * (i / stair.steps);
    pts.push([xs, pts[pts.length - 1][1]]);
    pts.push([xs, ys]);
  }
  return pts;
}

/** The view series with its freeze plateau and optional unlock jump. */
export function viewSeriesPoints(view: ViewSeries): Point[] {
  const pts = stairPoints(view.stair);
  if (view.flatTo !== undefined) pts.push([view.flatTo, pts[pts.length - 1][1]]);
  if (view.jump) {
    pts.push([view.jump.atX, pts[pts.length - 1][1]]);
    pts.push([view.jump.atX, view.jump.toY]);
    pts.push([1, view.jump.endY]);
  }
  return pts;
}

/** y of a series at a given normalized x. Flat and sloped segments are
 *  linearly interpolated; on a vertical riser the top point wins. */
export function seriesYAt(pts: readonly Point[], x: number): number {
  if (x <= pts[0][0]) return pts[0][1];
  for (let i = 1; i < pts.length; i += 1) {
    if (x < pts[i][0]) {
      const [x0, y0] = pts[i - 1];
      const [x1, y1] = pts[i];
      if (x <= x0) return y0;
      return y0 + ((x - x0) / (x1 - x0)) * (y1 - y0);
    }
    if (x === pts[i][0]) {
      let j = i;
      while (j + 1 < pts.length && pts[j + 1][0] === x) j += 1;
      return pts[j][1];
    }
  }
  return pts[pts.length - 1][1];
}

/** SVG path from normalized points. */
export function seriesPath(frame: PlotFrame, pts: readonly Point[]): string {
  return pts
    .map(
      (p, i) =>
        `${i === 0 ? "M" : "L"}${mapX(frame, p[0]).toFixed(1)} ${mapY(frame, p[1]).toFixed(1)}`,
    )
    .join(" ");
}

/* ------------------------------------------------------------------ */
/* Text fitting (the round-2 review note, promoted to an invariant)    */
/* ------------------------------------------------------------------ */

/**
 * Conservative monospace width estimate: ui-monospace advances ~0.6em per
 * glyph; 0.62 x 1.08 adds safety so anything passing here fits on screen.
 */
export function estimateTextWidth(text: string, fontPx: number, trackingEm: number): number {
  const glyph = fontPx * 0.62 * 1.08;
  const tracking = trackingEm * fontPx;
  return text.length * (glyph + tracking);
}

const ZONE_PAD = 8;

/** True when the string fits inside the zone with padding. */
export function textFits(text: string, z: Zone): boolean {
  return estimateTextWidth(text, z.fontPx, z.trackingEm) <= z.w - ZONE_PAD;
}

/* ------------------------------------------------------------------ */
/* Legend content (round 3.2): the figure's whole vocabulary            */
/* ------------------------------------------------------------------ */

export const LEGEND_LINE_1 = "P-CHAIN · LIVE REGISTRY";
export const LEGEND_LINE_2 = "YOUR L1'S VIEW · ALWAYS AT OR BEHIND";

/** Legend swatch length in px, per layout kind. */
export const legendSwatch = (layout: FigureLayout): number =>
  layout.kind === "desktop" ? 22 : 20;

export type MarkGlyph = "block" | "registration" | "skip";

export interface GlossaryEntry {
  readonly glyph: MarkGlyph;
  readonly label: string;
  /** Glyph center x. */
  readonly cx: number;
  /** Label start x. */
  readonly textX: number;
}

/** Mark half-size in the glossary row, per layout kind. */
export const glossaryMark = (layout: FigureLayout): number =>
  layout.kind === "desktop" ? 4 : 3.5;

/** The marks glossary row: positions shared by the renderer and the tests. */
export function markGlossary(layout: FigureLayout): readonly GlossaryEntry[] {
  const z = layout.zones.legend3;
  const mark = glossaryMark(layout);
  const gap = layout.kind === "desktop" ? 16 : 12;
  const entries: Array<{ glyph: MarkGlyph; label: string }> = [
    { glyph: "block", label: "BLOCK" },
    { glyph: "registration", label: "REGISTRATION" },
    { glyph: "skip", label: "SKIPPED SLOT" },
  ];
  let cx = z.x + 2 + mark;
  return entries.map(({ glyph, label }) => {
    const textX = cx + mark + 6;
    const entry: GlossaryEntry = { glyph, label, cx, textX };
    cx = textX + estimateTextWidth(label, z.fontPx, z.trackingEm) + gap + mark;
    return entry;
  });
}

/* ------------------------------------------------------------------ */
/* The heights ruler (round 3.3): three P-Chain heights on one axis     */
/* ------------------------------------------------------------------ */

export interface RulerLayout {
  readonly kind: "desktop" | "mobile";
  readonly viewBox: { readonly w: number; readonly h: number };
  readonly axisY: number;
  readonly axisX0: number;
  readonly axisX1: number;
  /** Marker centers on the axis; brk is the axis-break glyph. */
  readonly marks: {
    readonly epoch: number;
    readonly brk: number;
    readonly tip: number;
    readonly live: number;
  };
  readonly zones: Readonly<Record<string, Zone>>;
}

export const rulerDesktop: RulerLayout = {
  kind: "desktop",
  viewBox: { w: 1000, h: 176 },
  axisY: 100,
  axisX0: 60,
  axisX1: 940,
  marks: { epoch: 200, brk: 430, tip: 660, live: 880 },
  zones: {
    nEpoch: zone("nEpoch", 110, 44, 180, 16, 11, 0.08),
    nTip: zone("nTip", 570, 44, 180, 16, 11, 0.08),
    nLive: zone("nLive", 790, 44, 180, 16, 11, 0.08),
    rEpoch: zone("rEpoch", 110, 64, 180, 14, 9.5, 0),
    rTip: zone("rTip", 570, 64, 180, 14, 9.5, 0),
    rLive: zone("rLive", 790, 64, 180, 14, 9.5, 0),
    vEpoch: zone("vEpoch", 110, 118, 180, 20, 15, 0),
    vTip: zone("vTip", 570, 118, 180, 20, 15, 0),
    vLive: zone("vLive", 790, 118, 180, 20, 15, 0),
    footer: zone("footer", 200, 150, 600, 18, 10.5, 0.1),
  },
};

/* Mobile drops the role lines; the footer carries the ordering law. */
export const rulerMobile: RulerLayout = {
  kind: "mobile",
  viewBox: { w: 480, h: 176 },
  axisY: 96,
  axisX0: 24,
  axisX1: 456,
  marks: { epoch: 110, brk: 205, tip: 290, live: 420 },
  zones: {
    nEpoch: zone("nEpoch", 50, 40, 120, 14, 9.5, 0.06),
    nTip: zone("nTip", 230, 40, 120, 14, 9.5, 0.06),
    nLive: zone("nLive", 358, 40, 118, 14, 9.5, 0.06),
    vEpoch: zone("vEpoch", 50, 110, 120, 18, 13, 0),
    vTip: zone("vTip", 230, 110, 120, 18, 13, 0),
    vLive: zone("vLive", 358, 110, 118, 18, 13, 0),
    footer: zone("footer", 40, 140, 400, 16, 8.5, 0.08),
  },
};

export type RulerMark = "epoch" | "tip" | "live";

export const RULER_NAMES: Readonly<Record<RulerMark, string>> = {
  epoch: "EPOCH HEIGHT",
  tip: "TIP EMBEDS",
  live: "P-CHAIN HEIGHT",
};

export const RULER_ROLES: Readonly<Record<RulerMark, string>> = {
  epoch: "pins what warp verifies",
  tip: "sets who may build next",
  live: "live registry · climbing",
};

/** The worked example's Bridge-block row: the one row where all three differ. */
export const RULER_VALUES: Readonly<Record<RulerMark, string>> = {
  epoch: "291,012",
  tip: "302,168",
  live: "302,171",
};

export const RULER_FOOTER = "EPOCH HEIGHT ≤ TIP EMBEDS ≤ P-CHAIN HEIGHT · ALWAYS";

const RULER_MARK_ORDER: readonly RulerMark[] = ["epoch", "tip", "live"];

/** Every string the ruler renders, paired with the zone it must fit. */
export function rulerTexts(
  layout: RulerLayout,
): ReadonlyArray<{ readonly text: string; readonly zone: Zone }> {
  const z = layout.zones;
  const cap = (k: RulerMark): string => k.charAt(0).toUpperCase() + k.slice(1);
  const out: Array<{ text: string; zone: Zone }> = [];
  for (const k of RULER_MARK_ORDER) {
    out.push({ text: RULER_NAMES[k], zone: z[`n${cap(k)}`] });
    const role = z[`r${cap(k)}`];
    if (role) out.push({ text: RULER_ROLES[k], zone: role });
    out.push({ text: RULER_VALUES[k], zone: z[`v${cap(k)}`] });
  }
  out.push({ text: RULER_FOOTER, zone: z.footer });
  return out;
}

/** Every string the figure renders, paired with the zone it must fit. */
export function figureTexts(
  layout: FigureLayout,
  data: FigureData,
): ReadonlyArray<{ readonly text: string; readonly zone: Zone }> {
  const z = layout.zones;
  const desktop = layout.kind === "desktop";
  const textInset = legendSwatch(layout) + 10;
  const shifted = (base: Zone, dx: number): Zone => ({ ...base, x: base.x + dx, w: base.w - dx });
  const out: Array<{ text: string; zone: Zone }> = [
    { text: LEGEND_LINE_1, zone: shifted(z.legend1, textInset) },
    { text: LEGEND_LINE_2, zone: shifted(z.legend2, textInset) },
  ];
  for (const entry of markGlossary(layout)) {
    out.push({
      text: entry.label,
      zone: { ...z.legend3, x: entry.textX, w: z.legend3.x + z.legend3.w - entry.textX },
    });
  }
  out.push({ text: desktop ? data.dim.label : data.dim.labelMobile, zone: shifted(z.dimL, 4) });
  const wordZones = [z.w1, z.w2, z.w3];
  data.phases.forEach((ph, i) => {
    out.push({ text: ph.label, zone: wordZones[i] });
  });
  return out;
}
