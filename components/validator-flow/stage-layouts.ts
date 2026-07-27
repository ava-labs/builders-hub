import type { ActorId } from "./data/types";

export interface StagePosition {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

export interface StageZone {
  readonly label: string;
  readonly kind: "l1" | "pchain";
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

export interface StageDimension {
  readonly x0: number;
  readonly x1: number;
  readonly y: number;
  readonly label: string;
}

export interface StageLayout {
  readonly viewBox: { readonly w: number; readonly h: number };
  readonly zones: readonly StageZone[];
  readonly actors: Readonly<Record<ActorId, StagePosition>>;
  readonly ruleXs: readonly number[];
  readonly dimension?: StageDimension;
  /** viewBox units cropped from the top of the sheet. */
  readonly topCrop?: number;
}

export interface RoutePoints {
  readonly x0: number;
  readonly y0: number;
  readonly xm: number;
  readonly ym: number;
  readonly x1: number;
  readonly y1: number;
}

export const desktopLayout: StageLayout = {
  viewBox: { w: 1000, h: 620 },
  zones: [
    { label: "L1 · SUBNET-EVM", kind: "l1", x: 40, y: 40, w: 560, h: 320 },
    { label: "P-CHAIN · REGISTRY", kind: "pchain", x: 680, y: 40, w: 280, h: 320 },
  ],
  actors: {
    l1: { x: 70, y: 100, w: 240, h: 100 },
    validators: { x: 70, y: 240, w: 490, h: 90 },
    pchain: { x: 710, y: 130, w: 220, h: 150 },
    owner: { x: 70, y: 470, w: 200, h: 100 },
    aggregator: { x: 390, y: 470, w: 250, h: 100 },
    node: { x: 720, y: 470, w: 210, h: 100 },
  },
  ruleXs: [193, 347, 500, 653, 807],
  dimension: {
    x0: 70,
    x1: 560,
    y: 346,
    label: "CURRENT SET · SIGNS TO 67% OF TOTAL WEIGHT",
  },
  topCrop: 12,
};

export const mobileLayout: StageLayout = {
  viewBox: { w: 480, h: 1060 },
  zones: [
    { label: "L1 · SUBNET-EVM", kind: "l1", x: 40, y: 160, w: 400, h: 260 },
    { label: "P-CHAIN · REGISTRY", kind: "pchain", x: 40, y: 700, w: 400, h: 150 },
  ],
  actors: {
    owner: { x: 60, y: 40, w: 360, h: 90 },
    l1: { x: 60, y: 200, w: 360, h: 90 },
    validators: { x: 60, y: 315, w: 360, h: 85 },
    aggregator: { x: 60, y: 540, w: 360, h: 90 },
    pchain: { x: 60, y: 740, w: 360, h: 90 },
    node: { x: 60, y: 930, w: 360, h: 85 },
  },
  ruleXs: [],
};

export function center(pos: StagePosition): { x: number; y: number } {
  return { x: pos.x + pos.w / 2, y: pos.y + pos.h / 2 };
}

const EDGE_OUTSET = 8;

// Point where the ray from the box center toward `toward` crosses the box
// boundary, pushed EDGE_OUTSET px past it so arrowheads and the travelling
// token sit visibly outside the box instead of underneath it.
function edgePoint(
  pos: StagePosition,
  toward: { x: number; y: number },
): { x: number; y: number } {
  const c = center(pos);
  const dx = toward.x - c.x;
  const dy = toward.y - c.y;
  const len = Math.hypot(dx, dy);
  if (len === 0) return c;
  const scaleX = dx === 0 ? Infinity : pos.w / 2 / Math.abs(dx);
  const scaleY = dy === 0 ? Infinity : pos.h / 2 / Math.abs(dy);
  const scale = Math.min(scaleX, scaleY) + EDGE_OUTSET / len;
  return { x: c.x + dx * scale, y: c.y + dy * scale };
}

export function routeBetween(
  layout: StageLayout,
  from: ActorId,
  to: ActorId,
): RoutePoints {
  const fromPos = layout.actors[from];
  const toPos = layout.actors[to];
  const a = center(fromPos);
  const b = center(toPos);
  const start = edgePoint(fromPos, b);
  const end = edgePoint(toPos, a);
  return {
    x0: start.x,
    y0: start.y,
    xm: (a.x + b.x) / 2,
    ym: (a.y + b.y) / 2 - 48,
    x1: end.x,
    y1: end.y,
  };
}
