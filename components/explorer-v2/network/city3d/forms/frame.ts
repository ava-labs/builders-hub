import { FLOOR, type Node, type Part } from "@/components/explorer-v2/network/icm-map";
import { TILT } from "@/components/explorer-v2/network/city-geometry";
import type { Building, CityModel, Inst, Tone } from "../model";

/* The districts' architecture works in each building's own frame: u runs
   along its right face's normal, v along its left face's (the face the sun
   lights), both in the plan's units from its ground point, and z is the
   height over its base. The city's squares are turned YAW to the plate, as
   the model's are. A form's massing tops out at its set's height, which is
   its validator count on the city's scale, and its footprint keeps to the
   one its lot gives it: a square footprint's half-size is w / sqrt 2. */

export const YAW = -Math.PI / 4;
const C = Math.cos(YAW);
const S = Math.sin(YAW);
const R2 = Math.SQRT2;
export { FLOOR };

/** the shapes the districts add to the model, each drawn as one instanced mesh (shapes.ts) */
export const SHAPE_KEYS = ["trim", "column", "gable", "saw", "bowl", "louver", "fan"] as const;
export type ShapeKey = (typeof SHAPE_KEYS)[number];
export const noShapes = (): Record<ShapeKey, Inst[]> => Object.fromEntries(SHAPE_KEYS.map((k) => [k, [] as Inst[]])) as Record<ShapeKey, Inst[]>;

/** where a part's glass goes: its ribbons' height (2.5, the model's), the storeys that carry it, or none */
export interface Glaze {
  h?: number;
  on?: (k: number) => boolean;
  none?: boolean;
}
/** a part of a district's massing: a box or a drum, and its glass; a drum may be an ellipse, `d` its radius along v */
export interface FormPart extends Part {
  d?: number;
  glass?: Glaze;
}
/** a point a drone sets a message down on: its offset in the plan, as a part's (dx, and dy on the screen), its height over the base, and the radius of free roof round it */
export interface Drop {
  dx: number;
  dy: number;
  z: number;
  r?: number;
}
/** a building as its district builds it: its massing and glass, its top and reach, the part its transactions light, what stands on and round it, and where on its roof a drone lands (the ground point at the top part's height when unset) */
export interface Plan {
  parts: FormPart[];
  crest: number;
  extent: number;
  shaft: number;
  dress: (m: CityModel & { shapes: Record<ShapeKey, Inst[]> }, bd: Building, b: number) => void;
  drop?: Drop;
  /** where its plaque and name stand, where not over the ground point at the crest */
  anchor?: Drop;
}

/** a point of a building's frame in the plan, off its ground point */
export const planAt = (u: number, v: number): [number, number] => [u * C + v * S, -u * S + v * C];

/** the reach a set's pick must hold, as its extent: the pick is a square round the ground point, a half of 0.75 extents (Buildings.tsx) */
export const pickReach = (reach: number) => (reach + 0.3) / 0.75;

/** a drone's landing point in a building's frame, and the radius its landing ring may take there */
export function dropAt(u: number, v: number, z: number, r?: number): Drop {
  const [wx, wz] = planAt(u, v);
  return { dx: wx, dy: wz * TILT, z, r };
}

/** a box of the massing: its half-sizes along u and v, from z0 to z1, its centre at (u, v) */
export function boxPart(hu: number, hv: number, z0: number, z1: number, u = 0, v = 0, glass?: Glaze): FormPart {
  const [wx, wz] = planAt(u, v);
  const l = hu * R2;
  const r = hv * R2;
  return { w: Math.max(l, r), l, r, z0, z1, dx: wx, dy: wz * TILT, glass };
}
/** a drum of the massing: its radii along u and v */
export function drumPart(ru: number, rv: number, z0: number, z1: number, glass?: Glaze): FormPart {
  return { w: ru, d: rv === ru ? undefined : rv, round: true, z0, z1, glass };
}

/** a box instance in a building's frame, turned with it */
export function boxAt(bd: Building, b: number, u: number, v: number, hu: number, hv: number, z0: number, z1: number): Inst {
  const [wx, wz] = planAt(u, v);
  return { b, x: bd.x + wx, y: bd.base + z0, z: bd.z + wz, sx: 2 * hu, sy: z1 - z0, sz: 2 * hv, yaw: YAW };
}
/** a shape's instance in a building's frame: its size along u, z and v, turned `turn` from the frame */
export function shapeAt(bd: Building, b: number, u: number, v: number, z0: number, su: number, sz: number, sv: number, turn = 0, pitch = 0): Inst {
  const [wx, wz] = planAt(u, v);
  return { b, x: bd.x + wx, y: bd.base + z0, z: bd.z + wz, sx: su, sy: sz, sz: sv, yaw: YAW + turn, pitch: pitch || undefined };
}

/** a box's four faces in its own frame: the outward normal, the face's half-run, its distance out from the centre, and the turn that faces a shape's front (+v) out of it */
export interface Face {
  nu: number;
  nv: number;
  half: number;
  depth: number;
  turn: number;
}
export function facesOf(hu: number, hv: number): Face[] {
  return [
    { nu: 0, nv: 1, half: hu, depth: hv, turn: 0 },
    { nu: 1, nv: 0, half: hv, depth: hu, turn: Math.PI / 2 },
    { nu: 0, nv: -1, half: hu, depth: hv, turn: Math.PI },
    { nu: -1, nv: 0, half: hv, depth: hu, turn: -Math.PI / 2 },
  ];
}
/** a point on a face: `s` along it from its middle, `t` out from it */
export const onFace = (f: Face, s: number, t: number): [number, number] => (f.nu !== 0 ? [f.nu * (f.depth + t), s] : [s, f.nv * (f.depth + t)]);
/** a box standing on a face: `along` its run and `out` from it, as half-sizes in the frame */
export const halvesOn = (f: Face, along: number, out: number): [number, number] => (f.nu !== 0 ? [out, along] : [along, out]);

/** how far in from a face's ends its glass stops, as a share of the face, as the model's */
export function insetOf(hu: number, hv: number, f: Face): number {
  const short = Math.min(hu, hv) * R2;
  const run = f.half * R2;
  return Math.max(0.02, ((short < 10 ? 0.17 : 0.12) * short) / run);
}
/** the glass's half-run on a face */
export const glassHalf = (hu: number, hv: number, f: Face) => f.half * (1 - 2 * insetOf(hu, hv, f));

/** a band of glass round a square's four faces, a hair proud of them, from z0 up sy: its ribbons' ids, for the flashes */
export function glassRound(m: CityModel, bd: Building, b: number, half: number, z0: number, sy: number, tone: Tone, out = 0.03): number[] {
  const ids: number[] = [];
  for (const f of facesOf(half, half)) {
    const [u, v] = onFace(f, 0, out);
    const [wx, wz] = planAt(u, v);
    ids.push(m.ribbons.length);
    m.ribbons.push({ b, x: bd.x + wx, y: bd.base + z0, z: bd.z + wz, sx: 2 * half * 0.98, sy, sz: 1, yaw: YAW + Math.PI / 2 - Math.atan2(f.nv, f.nu), k: -1, tone });
  }
  return ids;
}

/** a storey's line: the height a storey starts at, plus a hair */
export const storeyAt = (k: number, over = 0.6) => k * FLOOR + over;

/** a form's own roll of the dice, as the map's */
export type Roll = () => number;
export type Former = (n: Node, roll: Roll) => Plan;
