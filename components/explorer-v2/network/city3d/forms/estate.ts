import type { Stop } from "@/components/explorer-v2/network/city";
import type { Building, CityModel } from "../model";
import { boxAt, facesOf, halvesOn, onFace, pickReach, planAt } from "./frame";

/* A private L1's estate (private.ts names them): its set stands inside a
   low wall in the massing's white, a pier at each corner, with one gate
   on the face toward the street its lot fronts, between two taller posts,
   its leaves in steel bars. The wall is turned with its set and keeps
   inside its lot's lines; it rises with its building, takes the cursor's
   light with it, and the pick and the camera hold it. No word says the set
   is private: the wall does. */

/** the wall's height and thickness, and a corner pier's half-size and height */
const WALL_H = 2.2;
const WALL_T = 0.5;
const PIER = 0.42;
const PIER_H = 2.7;
/** the gate: half its opening, and its posts' half-size and height */
const GATE = 2.6;
const POST = 0.6;
const POST_H = 3.6;
/** the gate's bars: their spacing, and their half-size */
const BAR = 0.42;
const BAR_W = 0.06;
/** how far the wall keeps inside its lot's lines, and the least yard it leaves round its set; a lot's block top stands this far in from its streets (paint.ts) */
const INSIDE = 2.4;
const YARD = 2.5;
const CURB = 1.5;

/** the heading, in the plan, of the street a lot fronts: out along its radius to the ring road outside its row, or in to the one inside it; toward downtown where the plan has no lot */
export function streetOf(lot: Pick<Stop, "r" | "a" | "road"> | undefined, x: number, z: number): [number, number] {
  if (!lot) {
    const d = Math.hypot(x, z) || 1;
    return [-x / d, -z / d];
  }
  const out = lot.road > lot.r ? 1 : -1;
  return [out * Math.cos(lot.a), out * Math.sin(lot.a)];
}

/** the face of a building's square (facesOf's order) that looks most nearly down a heading in the plan */
export function faceToward([dx, dz]: [number, number]): number {
  let best = 0;
  let most = -Infinity;
  facesOf(1, 1).forEach((f, i) => {
    const [wx, wz] = planAt(f.nu, f.nv);
    if (wx * dx + wz * dz > most) {
      most = wx * dx + wz * dz;
      best = i;
    }
  });
  return best;
}

/** the estate round a private set, from its lot in the plan and the plan's lot pitch */
export function estateOf(m: CityModel, bd: Building, b: number, lot: Pick<Stop, "r" | "a" | "road"> | undefined, pitch: number | undefined) {
  const heading = streetOf(lot, bd.x, bd.z);
  const gate = faceToward(heading);
  /* the lot's half-width at its ground point: along its radius a half pitch, short of the curb, and across it the arc its
     row takes, which is a pitch at its block's middle (city.ts plotWard) */
  const across = lot && pitch ? 0.5 * pitch * Math.min(1, lot.r / (lot.r + (lot.road < lot.r ? 0.5 : -0.5) * pitch)) : Infinity;
  const lotHalf = Math.min(across, pitch ? 0.5 * pitch - CURB : Infinity);
  // how far the turned square reaches along the lot's radius (and across it), a unit of its half-size
  const [u1, v1] = [planAt(1, 0), planAt(0, 1)];
  const k = Math.abs(heading[0] * u1[0] + heading[1] * u1[1]) + Math.abs(heading[0] * v1[0] + heading[1] * v1[1]);
  // the wall's half-size in the set's frame: as far out as the lot lets it, at least a yard off the set and at most four more
  const own = bd.extent / Math.SQRT2 + YARD;
  const half = Math.max(own, Math.min((lotHalf - INSIDE) / k, own + 4));
  const trim = m.shapes.trim;
  const faces = facesOf(half, half);
  // a run of the wall along a face, from s0 to s1 along it, under its coping
  const run = (i: number, s0: number, s1: number) => {
    const f = faces[i];
    const [u, v] = onFace(f, (s0 + s1) / 2, 0);
    const [hu, hv] = halvesOn(f, (s1 - s0) / 2, WALL_T / 2);
    m.boxes.push(boxAt(bd, b, u, v, hu, hv, 0, WALL_H));
    const [cu, cv] = halvesOn(f, (s1 - s0) / 2, WALL_T / 2 + 0.12);
    trim.push(boxAt(bd, b, u, v, cu, cv, WALL_H, WALL_H + 0.2));
  };
  faces.forEach((_, i) => {
    if (i === gate) {
      run(i, -half, -(GATE + POST));
      run(i, GATE + POST, half);
    } else run(i, -half, half);
  });
  // a pier at each corner, a little over the wall, under its cap
  for (const [su, sv] of [
    [1, 1],
    [1, -1],
    [-1, 1],
    [-1, -1],
  ]) {
    m.boxes.push(boxAt(bd, b, su * half, sv * half, PIER, PIER, 0, PIER_H));
    trim.push(boxAt(bd, b, su * half, sv * half, PIER + 0.1, PIER + 0.1, PIER_H, PIER_H + 0.2));
  }
  // the gate: two posts under their caps, and between them its leaves, steel bars between a rail at their foot and one at their head
  const f = faces[gate];
  for (const s of [-(GATE + POST), GATE + POST]) {
    const [u, v] = onFace(f, s, 0);
    m.boxes.push(boxAt(bd, b, u, v, POST, POST, 0, POST_H));
    trim.push(boxAt(bd, b, u, v, POST + 0.14, POST + 0.14, POST_H, POST_H + 0.28));
  }
  const bars = Math.round((2 * GATE) / BAR);
  for (let j = 1; j < bars; j++) {
    const [u, v] = onFace(f, -GATE + (2 * GATE * j) / bars, 0);
    const [hu, hv] = halvesOn(f, BAR_W, BAR_W);
    m.steel.push(boxAt(bd, b, u, v, hu, hv, 0.2, WALL_H + 0.5));
  }
  for (const [z0, z1] of [
    [0.35, 0.5],
    [WALL_H + 0.2, WALL_H + 0.35],
  ]) {
    const [u, v] = onFace(f, 0, 0);
    const [hu, hv] = halvesOn(f, GATE, 0.07);
    m.steel.push(boxAt(bd, b, u, v, hu, hv, z0, z1));
  }
  // the pick and the camera hold the whole estate
  bd.extent = Math.max(bd.extent, pickReach(half + POST));
}
