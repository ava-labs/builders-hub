"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame, type ThreeEvent } from "@react-three/fiber";
import {
  BoxGeometry,
  BufferGeometry,
  Color,
  CylinderGeometry,
  DoubleSide,
  DynamicDrawUsage,
  Float32BufferAttribute,
  IcosahedronGeometry,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  MeshPhongMaterial,
  Quaternion,
  ShaderMaterial,
  Shape,
  ShapeGeometry,
  Vector3,
  Vector4,
} from "three";
import { diceOf } from "@/components/explorer-v2/network/city-geometry";
import { FLOOR, PCHAIN_PICK, type Glass } from "@/components/explorer-v2/network/city-model";
import { chamferOf } from "@/components/explorer-v2/network/hub-tower";
import type { PchainPulse } from "@/components/explorer-v2/network/pchain-pulse";
import { GLASS3, MASS3, type Theme } from "./palette";
import { massMaterial, riseDepth, RISE_S, TIME } from "./shaders";
import type { Building, CityModel, Ribbon } from "./model";

/* Downtown as the Primary Network, drawn as an institution's supertall:
   one landmark of three wings on one podium, the C-, P- and X-Chains.
   The C wing stands in front and tallest, cut as a crystal: its square
   is turned to the plate with its corners cut, the cuts deeper as it
   rises and narrows. Its curtain wall is two reds: panes of deep red
   glass a storey tall on every face, between hairline mullions in the
   brand's red, and a steel band at each floor. At its top a lantern of
   the same glass behind close-set steel fins, a steel lid, and a
   slender steel spire with one red aircraft light; the name is the
   city's label, not the building's. The P wing, behind it to the
   right, is the P-Chain's headquarters: slate glass with a steel
   hairline at each floor, a flat roof with the P-Chain's letter set
   into it, where its helicopters fly from, and a small blue beacon;
   each P-Chain tx that lands lights a storey of it blue. The X wing,
   behind to the left, is the quietest and the lowest, in pale steel.
   The wings step back at sky lobbies a third and half way up, and steel
   bridges join them there. A transfer out of the P-Chain plays from the
   P wing to the crown: its beacon flares, a light crosses the upper
   bridge, the C wing's sky lobby lights, the light climbs its front and
   the lantern's band flashes red; one into the P-Chain plays the other
   way. Each light comes on fast and fades long, as the brand's motion
   does. The tower stands on a forecourt of two stone steps and a podium
   of pale glass behind steel fins, entered up a broad stair under a
   flat steel canopy. It draws in four meshes, and a fifth while a
   transfer plays: the massing, its stone and steel each in its own
   color; the C wing's glass, which lights in the city's wave and
   flashes with the C-Chain's transactions as the city's glass does; the
   P wing's glass; and the lights. The X wing's glass, the podium's, the
   lobbies' and the bridges' are the city's own (hubWindows). */

type Pt = [number, number];
type Tone = Ribbon["tone"];
type WingKey = "c" | "p" | "x";
/** a window of the tower round its ground point: a ribbon of the city's glass */
export type HubWindow = Omit<Ribbon, "b">;

/** the pick that opens the P-Chain, from its wing (city-model.ts keeps it, so the app need not load this file to read it) */
export { PCHAIN_PICK };

/* each wing: its ground point on the podium and its size, over the tower's half-width; its top, over the tower's height; its corners' cut at its foot and at its top; how much it narrows as it rises */
const WINGS: Record<WingKey, { at: Pt; size: number; top: number; cut: [number, number]; taper: number }> = {
  c: { at: [0, 0.28], size: 0.58, top: 1, cut: [0.12, 0.26], taper: 0.88 },
  p: { at: [0.86, -0.34], size: 0.48, top: 0.62, cut: [0.2, 0.2], taper: 0.96 },
  x: { at: [-0.86, -0.34], size: 0.46, top: 0.42, cut: [0.2, 0.2], taper: 0.97 },
};
/** the sky lobbies' heights over the tower's, and how far a lobby stands back, over the half-width */
const LOBBIES = [0.28, 0.46];
const LOBBY_SET = 0.06;
/** the bridges between the wings: which join, and at which lobbies */
const BRIDGES: { a: WingKey; b: WingKey; at: number[] }[] = [
  { a: "p", b: "c", at: [0, 1] },
  { a: "x", b: "c", at: [0] },
  { a: "x", b: "p", at: [0] },
];
/** a bridge's width */
const BRIDGE_W = 4.6;
/** the podium's height, where the wings start; the C wing's lantern and its lid */
const PODIUM = 20;
const LANTERN = 13;
const LID = 2;
/** how far glass stands proud of its wall */
const PROUD = 0.14;
/** the curtain wall: the gap its glass leaves over and under each floor; a floor band's rise and how far it stands out, over the half-width; the X wing's mullions' spacing, width and depth, and a corner post's width (the C wing's are drawn in its glass) */
const JOINT = 0.22;
const BAND = { rise: 0.36, out: 0.02 };
const MULLION = { every: 2.3, wd: 0.2, d: 0.34, post: 0.36 };
/** the lantern's fins: their spacing, width and depth */
const FIN = { every: 1.2, wd: 0.16, d: 0.5 };
/** the C wing's glass, light then dark: its panes and the mullions between them, how much each lights itself, and a flash's; a mullion's half-width, and a corner's over it (each never thinner than about a pixel) */
const C_GLASS = {
  pane: ["#B20F2A", "#820419"],
  mullion: ["#E6212F", "#E6212F"],
  glow: [0.05, 0.6],
  mullionGlow: [0.05, 0.9],
  flashGlow: [0.6, 0.9],
} as const;
const MULL_HALF = 0.12;
const CORNER = 1.8;
/** the C wing's storeys its glass can color, the last its lantern's; the storeys its transactions can light at once */
const C_SLOTS = 32;
const C_TOP = C_SLOTS - 1;
const C_FLASHES = 6;
/** the forecourt's steps: their reach over the half-width, their cut and their rise; the podium's reach and cut */
const STEPS = [2.2, 1.95];
const STEP_CUT = 0.2;
const STEP_H = 1.6;
const PODIUM_R = 1.8;
const PODIUM_CUT = 0.24;
/** the stair's half-width over the tower's; the canopy over its head: its height, its thickness and how far it reaches out from the podium */
const STAIR_W = 0.4;
const CANOPY = { at: PODIUM - 7, t: 0.5, out: 5 };
/** the C wing's spire, on its roof's middle: its footing's width and rise, its height from the footing, its radius at the foot and the tip, and its aircraft light's */
const SPIRE_FOOT: [number, number] = [2.2, 1.2];
const SPIRE_H = 22;
const SPIRE_R: [number, number] = [0.55, 0.12];
const AIRCRAFT_R = 0.62;
/** where a helicopter's message lands on the C wing: its roof in front of the spire, from the roof's middle, over the half-width */
const ROOF_AT: Pt = [0, 0.2];
/** how high the tower reaches over its roof: the spire's aircraft light */
export const HUB_REACH = SPIRE_FOOT[1] + SPIRE_H + AIRCRAFT_R;
/** the P and X wings' roofs: how far each stands out over its wing, over the half-width, and its rise; the P-Chain's letter set into the P wing's roof, its size over the half-width; the beacon's mast */
const ROOF_OUT = 0.03;
const ROOF_SLAB = 1.2;
const LETTER = 0.061;
const BEACON_MAST = 4.4;
/** the P wing's hairline bands' half-width, never thinner than about a pixel */
const P_HAIR = 0.12;
/** the massing's own colors, which the theme then tints: the stone of the forecourt, the stair and the cornice; the slate of the cores, the lobbies' walls, the bridges' boxes and the P wing's roof; the brand's gray of the podium's fins, the canopy and the bridges' decks; the C wing's steel, the X wing's pale steel over its pale core */
const PAINT = {
  stone: "#EBF0FA",
  slate: "#3B484B",
  gray: "#A2AFB2",
  cSteel: "#A2AFB2",
  xSteel: "#E1E6E9",
  xCore: "#C9D0D4",
} as const;
/** the massing's tint by day and at night */
const TINT = ["#FFFFFF", "#4A4F5C"] as const;
/** the P wing's glass in slate, light then dark: the glass, its shine, its glow at night, its steel hairlines and how much they light themselves, a tx's flash in the brand's blue; the roof's deck and the letter set into it */
const P_GLASS = {
  glass: ["#3B484B", "#3B484B"],
  specular: ["#B4BCCB", "#5A607A"],
  glow: ["#000000", "#10151F"],
  band: ["#A2AFB2", "#A2AFB2"],
  bandGlow: [0, 0.35],
  flash: ["#0061E2", "#5F9DFF"],
  deck: ["#EBF0FA", "#1F1F1F"],
  mark: ["#3B484B", "#A2AFB2"],
} as const;
/** the brand's blue by day and at night: the P wing's beacon, its flashes and a transfer's light */
const BLUE = { day: new Color("#0061E2"), night: new Color("#5F9DFF") };
/** the brand's reds: the aircraft light by day and at night; the crown's band at a transfer's end takes the light red in both, so it reads on the deep red glass */
const RED = { day: new Color("#E6212F"), night: new Color("#FF394A") };
/** the P storeys a flash can light, at most */
const P_MAX = 32;
/** a P-Chain storey's flash, in seconds, its rise then its fade; its strength by day, over the night's */
const FLASH_IN = 0.08;
const FLASH_S = 1.2;
const DAY_FLASH = 0.5;
/** a transfer's beats, in seconds: the light's run across the bridge, the C wing's lobby lighting, the light's climb up its front, the crown's flash, the beacon's; and the whole */
const CROSS_S = 1.4;
const BAND_S = 1.1;
const SPARK_S = 0.8;
const CROWN_S = 1.3;
const BEACON_S = 0.9;
const TRANSFER_S = 3.6;
/** the brand's motion, cubic-bezier(0.16, 1, 0.3, 1): a fast attack and a long decay */
const expoOut = (u: number) => (u >= 1 ? 1 : 1 - Math.pow(2, -10 * Math.max(0, u)));
/* a light x seconds after it starts: up to full in `rise`, then down over `fade` */
const pulseOf = (x: number, rise: number, fade: number) => (x < 0 || x > rise + fade ? 0 : x < rise ? expoOut(x / rise) : 1 - expoOut((x - rise) / fade));

const V = (x: number, y: number, z: number) => new Vector3(x, y, z);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
const shift = (A: Pt[], c: Pt): Pt[] => A.map(([x, z]) => [x + c[0], z + c[1]]);

/* a mesh of flat faces, each turned to face out, merged into one; each vertex carries a color, and may carry a kind */
class Faces {
  pos: number[] = [];
  nrm: number[] = [];
  col: number[] = [];
  kinds: number[] = [];
  /** the color and the kind the next faces carry */
  color: [number, number, number] = [1, 1, 1];
  kind = 0;
  paint(hex: string) {
    const c = new Color(hex);
    this.color = [c.r, c.g, c.b];
  }
  tri(a: Vector3, b: Vector3, c: Vector3, out: Vector3) {
    const n = new Vector3().subVectors(b, a).cross(new Vector3().subVectors(c, a));
    if (n.lengthSq() < 1e-10) return;
    const flip = n.dot(out) < 0;
    n.multiplyScalar(flip ? -1 : 1).normalize();
    for (const v of flip ? [a, c, b] : [a, b, c]) {
      this.pos.push(v.x, v.y, v.z);
      this.nrm.push(n.x, n.y, n.z);
      this.col.push(...this.color);
      this.kinds.push(this.kind);
    }
  }
  quad(a: Vector3, b: Vector3, c: Vector3, d: Vector3, out: Vector3) {
    this.tri(a, b, c, out);
    this.tri(a, c, d, out);
  }
  /** a prism from plan A at y0 to plan B at y1, corner for corner, its walls facing away from c */
  prism(A: Pt[], B: Pt[], y0: number, y1: number, { top = true, bottom = false, c = [0, 0] as Pt } = {}) {
    for (let i = 0; i < A.length; i++) {
      const j = (i + 1) % A.length;
      const out = V((A[i][0] + A[j][0]) / 2 - c[0], 0, (A[i][1] + A[j][1]) / 2 - c[1]);
      this.quad(V(A[i][0], y0, A[i][1]), V(A[j][0], y0, A[j][1]), V(B[j][0], y1, B[j][1]), V(B[i][0], y1, B[i][1]), out);
    }
    if (top) this.cap(B, y1, 1);
    if (bottom) this.cap(A, y0, -1);
  }
  /** a flat plan at y, facing up (1) or down (-1) */
  cap(P: Pt[], y: number, up: number) {
    const m = P.reduce<Pt>((s, p) => [s[0] + p[0] / P.length, s[1] + p[1] / P.length], [0, 0]);
    P.forEach((p, i) => {
      const q = P[(i + 1) % P.length];
      this.tri(V(m[0], y, m[1]), V(p[0], y, p[1]), V(q[0], y, q[1]), V(0, up, 0));
    });
  }
  /** a box standing on its base, turned by yaw */
  box(x: number, y: number, z: number, sx: number, sy: number, sz: number, yaw = 0) {
    const c = Math.cos(yaw);
    const s = Math.sin(yaw);
    const at = (u: number, v: number): Pt => [x + u * c + v * s, z - u * s + v * c];
    const R = [at(-sx / 2, -sz / 2), at(sx / 2, -sz / 2), at(sx / 2, sz / 2), at(-sx / 2, sz / 2)];
    this.prism(R, R, y, y + sy, { bottom: true, c: [x, z] });
  }
  /** a fin standing d out from a line up a wall, from p0 at y0 to p1 at y1: wd wide along the wall's run t, out along its normal n */
  fin(p0: Pt, p1: Pt, y0: number, y1: number, t: Pt, n: Pt, wd: number, d: number) {
    const q = (p: Pt): Pt[] => [
      [p[0] - (t[0] * wd) / 2, p[1] - (t[1] * wd) / 2],
      [p[0] + (t[0] * wd) / 2, p[1] + (t[1] * wd) / 2],
      [p[0] + (t[0] * wd) / 2 + n[0] * d, p[1] + (t[1] * wd) / 2 + n[1] * d],
      [p[0] - (t[0] * wd) / 2 + n[0] * d, p[1] - (t[1] * wd) / 2 + n[1] * d],
    ];
    this.prism(q(p0), q(p1), y0, y1, { c: [p0[0] + (n[0] * d) / 2, p0[1] + (n[1] * d) / 2] });
  }
  build(withKind = false): BufferGeometry {
    const g = new BufferGeometry();
    g.setAttribute("position", new Float32BufferAttribute(this.pos, 3));
    g.setAttribute("normal", new Float32BufferAttribute(this.nrm, 3));
    g.setAttribute("color", new Float32BufferAttribute(this.col, 3));
    if (withKind) g.setAttribute("aKind", new Float32BufferAttribute(this.kinds, 1));
    g.computeBoundingSphere();
    return g;
  }
}

/* the tower's frame on a half-width w and a height h: each wing's ground point, its top and its plan at a height, the P and X wings' roofs, the lobbies' floors, each wing's runs of storeys between them, the P wing's storeys and the C wing's */
function frameOf(w: number, h: number) {
  const lobbies = LOBBIES.map((f) => Math.round((h * f) / FLOOR) * FLOOR);
  const crown = Math.floor((h - LANTERN) / FLOOR) * FLOOR;
  const top: Record<WingKey, number> = { c: crown, p: Math.floor((h * WINGS.p.top) / FLOOR) * FLOOR, x: Math.floor((h * WINGS.x.top) / FLOOR) * FLOOR };
  const centre = (k: WingKey): Pt => [w * WINGS[k].at[0], w * WINGS[k].at[1]];
  const plan = (k: WingKey, z: number, set = 0): Pt[] => {
    const g = WINGS[k];
    const t = clamp01((z - PODIUM) / (top[k] - PODIUM));
    return shift(chamferOf(w * (g.size * lerp(1, g.taper, t) - set), lerp(g.cut[0], g.cut[1], t)), centre(k));
  };
  const roof = (k: WingKey) => plan(k, top[k], -ROOF_OUT);
  const lobbiesOf = (k: WingKey) => lobbies.filter((z) => z + FLOOR <= top[k] - FLOOR);
  const runsOf = (k: WingKey): [number, number][] => {
    const edges = [PODIUM, ...lobbiesOf(k).flatMap((z) => [z, z + FLOOR]), top[k]];
    return edges.flatMap((z, i) => (i % 2 === 0 ? [[z, edges[i + 1]] as [number, number]] : []));
  };
  // the P wing's storeys, run by run, each the band between two floors
  const pStoreys = runsOf("p").flatMap(([z0, z1]) => {
    const out: [number, number][] = [];
    for (let z = z0; z < z1 - 0.5; z = Math.min(z1, Math.floor(z / FLOOR) * FLOOR + FLOOR)) out.push([z, Math.min(z1, Math.floor(z / FLOOR) * FLOOR + FLOOR)]);
    return out;
  });
  // the C wing's storeys, run by run: each its index, the run it is in, and its glass's foot and head between two floors' joints
  const cStoreys = runsOf("c").flatMap(([z0, z1], run) => {
    const out: { k: number; run: number; y0: number; y1: number }[] = [];
    for (let k = Math.floor(z0 / FLOOR); k * FLOOR < z1 - 0.5; k++) {
      const y0 = Math.max(z0, k * FLOOR) + JOINT;
      const y1 = Math.min(z1, (k + 1) * FLOOR) - JOINT;
      if (y1 - y0 >= 1) out.push({ k, run, y0, y1 });
    }
    return out;
  });
  return { lobbies, crown, top, centre, plan, roof, lobbiesOf, runsOf, pStoreys, cStoreys };
}
type Frame = ReturnType<typeof frameOf>;

/* a wall's run and its outward normal in the plan, for a wall from a to b of a plan round c; and its length */
function runOf(a: Pt, b: Pt, c: Pt): { t: Pt; n: Pt; len: number } {
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const t: Pt = [(b[0] - a[0]) / len, (b[1] - a[1]) / len];
  let n: Pt = [t[1], -t[0]];
  if (n[0] * ((a[0] + b[0]) / 2 - c[0]) + n[1] * ((a[1] + b[1]) / 2 - c[1]) < 0) n = [-n[0], -n[1]];
  return { t, n, len };
}
/* where a ray from inside a convex plan leaves it: the distance along a unit direction */
function exitOf(P: Pt[], from: Pt, d: Pt): number {
  let best = Infinity;
  P.forEach((a, i) => {
    const b = P[(i + 1) % P.length];
    const e: Pt = [b[0] - a[0], b[1] - a[1]];
    const den = d[0] * e[1] - d[1] * e[0];
    if (Math.abs(den) < 1e-9) return;
    const t = ((a[0] - from[0]) * e[1] - (a[1] - from[1]) * e[0]) / den;
    const u = ((a[0] - from[0]) * d[1] - (a[1] - from[1]) * d[0]) / den;
    if (t > 0 && u >= -1e-6 && u <= 1 + 1e-6) best = Math.min(best, t);
  });
  return best;
}
/* a bridge's run between its wings at a lobby: its ends on the two wings' walls, its heading */
function bridgeOf(f: Frame, a: WingKey, b: WingKey, z: number) {
  const ca = f.centre(a);
  const cb = f.centre(b);
  const len = Math.hypot(cb[0] - ca[0], cb[1] - ca[1]);
  const d: Pt = [(cb[0] - ca[0]) / len, (cb[1] - ca[1]) / len];
  const ta = exitOf(f.plan(a, z), ca, d);
  const tb = len - exitOf(f.plan(b, z), cb, [-d[0], -d[1]]);
  const from: Pt = [ca[0] + d[0] * ta, ca[1] + d[1] * ta];
  const to: Pt = [ca[0] + d[0] * tb, ca[1] + d[1] * tb];
  return { ca, cb, len, d, from, to, yaw: Math.atan2(d[0], d[1]) };
}

/* a window on a wall of a plan that changes with height: wall i of plan(y) and plan(y + dy), its foot at y, its width a share of the wall or the wall less an inset */
function wallWindow(plan: (z: number) => Pt[], c: Pt, i: number, y: number, dy: number, width: (len: number) => number, k: number, tone: Tone, proud = PROUD): HubWindow {
  const P0 = plan(y);
  const P1 = plan(y + dy);
  const j = (i + 1) % P0.length;
  const a0 = V(P0[i][0], y, P0[i][1]);
  const b0 = V(P0[j][0], y, P0[j][1]);
  const a1 = V(P1[i][0], y + dy, P1[i][1]);
  const n = new Vector3().subVectors(b0, a0).cross(new Vector3().subVectors(a1, a0)).normalize();
  const mid = a0.clone().add(b0).multiplyScalar(0.5);
  if (n.x * (mid.x - c[0]) + n.z * (mid.z - c[1]) < 0) n.negate();
  const pitch = -Math.asin(Math.max(-1, Math.min(1, n.y)));
  const len = Math.min(a0.distanceTo(b0), a1.distanceTo(V(P1[j][0], y + dy, P1[j][1])));
  return { x: mid.x + n.x * proud, y: mid.y + n.y * proud, z: mid.z + n.z * proud, sx: Math.max(0.2, width(len)), sy: dy / Math.cos(pitch), sz: 1, yaw: Math.atan2(n.x, n.z), pitch, k, tone };
}
/* a window on a vertical face from a to b, its foot at y, facing away from c */
function faceWindow(a: Pt, b: Pt, y: number, sy: number, sx: number, k: number, tone: Tone, c: Pt, proud = PROUD): HubWindow {
  const [mx, mz] = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
  let [nx, nz] = [(b[1] - a[1]) / len, -(b[0] - a[0]) / len];
  if (nx * (mx - c[0]) + nz * (mz - c[1]) < 0) [nx, nz] = [-nx, -nz];
  return { x: mx + nx * proud, y, z: mz + nz * proud, sx, sy, sz: 1, yaw: Math.atan2(nx, nz), k, tone };
}

/* the X wing's curtain wall over one run of storeys: a pale pane a storey tall between two floors' joints, on each of its eight faces */
function curtainOf(f: Frame, key: WingKey, z0: number, z1: number, tone: Tone): HubWindow[] {
  const out: HubWindow[] = [];
  const c = f.centre(key);
  for (let k = Math.floor(z0 / FLOOR); k * FLOOR < z1 - 0.5; k++) {
    const ya = Math.max(z0, k * FLOOR) + JOINT;
    const yb = Math.min(z1, (k + 1) * FLOOR) - JOINT;
    if (yb - ya < 1) continue;
    for (let i = 0; i < 8; i++) out.push(wallWindow((z) => f.plan(key, z), c, i, ya, yb - ya, (l) => l - 0.24, -1, tone));
  }
  return out;
}

/** the tower's glass that the city draws, round its ground point: the podium's, the X wing's curtain wall, the lobbies' and the bridges'. The C wing's and the P wing's are the tower's own (hubTowerParts) */
export function windowsOf(w: number, h: number): HubWindow[] {
  const out: HubWindow[] = [];
  const f = frameOf(w, h);
  const base = STEP_H * STEPS.length;
  // the podium's pale glass, behind its fins
  const pod = chamferOf(w * PODIUM_R, PODIUM_CUT);
  pod.forEach((a, i) => {
    const b = pod[(i + 1) % pod.length];
    out.push(faceWindow(a, b, base + 0.3, PODIUM - 1.5 - base - 0.5, Math.hypot(b[0] - a[0], b[1] - a[1]) - 0.6, -1, "crown", [0, 0], -0.1));
  });
  for (const [z0, z1] of f.runsOf("x")) out.push(...curtainOf(f, "x", z0, z1, "crown"));
  // each wing's sky lobbies, set back, in pale glass all round
  for (const key of ["c", "p", "x"] as WingKey[])
    for (const z of f.lobbiesOf(key)) {
      const L = f.plan(key, z, LOBBY_SET);
      for (let i = 0; i < 8; i++) out.push(wallWindow(() => L, f.centre(key), i, z + 0.9, FLOOR - 1.8, (l) => l - 0.4, -1, "crown"));
    }
  // the bridges' glass, down each side between the wings
  for (const br of BRIDGES)
    for (const li of br.at) {
      const z = f.lobbies[li];
      const b = bridgeOf(f, br.a, br.b, z);
      const n: Pt = [b.d[1], -b.d[0]];
      const mid: Pt = [(b.from[0] + b.to[0]) / 2, (b.from[1] + b.to[1]) / 2];
      const run = Math.hypot(b.to[0] - b.from[0], b.to[1] - b.from[1]);
      for (const s of [1, -1]) {
        const at: Pt = [mid[0] + n[0] * s * (BRIDGE_W / 2 + PROUD), mid[1] + n[1] * s * (BRIDGE_W / 2 + PROUD)];
        out.push({ x: at[0], y: z + 1.4, z: at[1], sx: run, sy: FLOOR - 2.8, sz: 1, yaw: Math.atan2(n[0] * s, n[1] * s), k: -1, tone: "crown" });
      }
    }
  return out;
}

/** downtown's glass in the city's list, as model.ts's hubRibbons lays it. The C wing's storeys light and flash in the tower's own glass (hubTowerParts), so the city lays no flashes on the tower */
export function hubWindows(m: CityModel, bd: Building) {
  const b = m.buildings.indexOf(bd);
  for (const it of windowsOf(bd.n.w, bd.n.h)) m.ribbons.push({ ...it, b, x: bd.x + it.x, y: bd.base + it.y, z: bd.z + it.z });
  bd.k0 = 0;
  bd.k1 = -1;
}

/* the helipad's middle round the tower's ground point: on the deck's top, on the P wing's roof */
function padOf(w: number, h: number): [number, number, number] {
  const f = frameOf(w, h);
  const c = f.centre("p");
  return [c[0], f.top.p + ROOF_SLAB + 0.03, c[1]];
}
/* the helicopters' world point on the tower: its ground point and base, and a point round it */
function worldOf(model: CityModel, at: (w: number, h: number) => [number, number, number]): [number, number, number] {
  const bd = model.buildings[model.hub];
  if (!bd) return [0, 0, 0];
  const [x, y, z] = at(bd.n.w, bd.n.h);
  return [bd.x + x, bd.base + y, bd.z + z];
}
/** where the P-Chain's helicopters take off: the middle of the helipad's deck, on the P wing's roof, in the world */
export const padAt = (model: CityModel) => worldOf(model, padOf);
/** where a helicopter's message lands on the C wing: its roof in front of the spire, in view from the plate's front, in the world */
export const cRoofAt = (model: CityModel) =>
  worldOf(model, (w, h) => {
    const c = frameOf(w, h).centre("c");
    return [c[0] + w * ROOF_AT[0], h, c[1] + w * ROOF_AT[1]];
  });
/** cRoofAt's first name, which Helicopters.tsx reads */
export const cDropAt = (model: CityModel) => cRoofAt(model);

/* the transfers the tower has been asked to play, out of the P-Chain to the C-Chain or into it, which it takes each frame */
const asked: ("toC" | "toP")[] = [];
/** plays a transfer: "toC" for an export from the P-Chain, "toP" for an import into it. The tower plays one itself for each import or export in the ledger it is given */
export function pulseBridge(dir: "toC" | "toP") {
  if (asked.length < 16) asked.push(dir);
}

/* the C wing's front, where a transfer's light climbs: its front face from over its upper lobby (z0) to under its lantern (z1), a point of it t across and `proud` out from it at a height */
function spineOf(f: Frame) {
  const cc = f.centre("c");
  const [z0, z1] = [f.lobbies[1] + FLOOR + 0.5, f.crown - 0.5];
  const at = (y: number, t: number, proud: number) => {
    const P = f.plan("c", y);
    const [a, b] = [P[2], P[3]];
    const [mx, mz] = [(a[0] + b[0]) / 2 - cc[0], (a[1] + b[1]) / 2 - cc[1]];
    const d = Math.hypot(mx, mz);
    return V(lerp(a[0], b[0], t) + (mx / d) * proud, y, lerp(a[1], b[1], t) + (mz / d) * proud);
  };
  return { z0, z1, at };
}

/* a transfer's path on the C wing, where the home view sees it: a band round its upper sky lobby (aU -1), a strip up its front from the lobby to the lantern, clear of the steel (aU its share of the way up), and a band round the lantern, clear of its fins (aU -2) */
function transferOf(w: number, h: number): BufferGeometry {
  const f = frameOf(w, h);
  const pos: number[] = [];
  const us: number[] = [];
  const quad = (a: Vector3, b: Vector3, c: Vector3, d: Vector3, ua: number, uc: number) => {
    for (const [p, u] of [[a, ua], [b, ua], [c, uc], [a, ua], [c, uc], [d, uc]] as [Vector3, number][]) {
      pos.push(p.x, p.y, p.z);
      us.push(u);
    }
  };
  // the band: just proud of the lobby's glass, all round, as tall as the lobby
  const z = f.lobbies[1];
  const L = f.plan("c", z, LOBBY_SET - 0.03);
  L.forEach((a, i) => {
    const b = L[(i + 1) % L.length];
    quad(V(a[0], z + 0.6, a[1]), V(b[0], z + 0.6, b[1]), V(b[0], z + FLOOR - 0.6, b[1]), V(a[0], z + FLOOR - 0.6, a[1]), -1, -1);
  });
  // the strip: most of the front face's width, out past its floor bands, storey by storey up the top run
  const { z0, z1, at } = spineOf(f);
  const out = w * BAND.out + 0.08;
  for (let y = z0; y < z1 - 0.01; y += FLOOR) {
    const y1 = Math.min(z1, y + FLOOR);
    quad(at(y, 0.18, out), at(y, 0.82, out), at(y1, 0.82, out), at(y1, 0.18, out), (y - z0) / (z1 - z0), (y1 - z0) / (z1 - z0));
  }
  // the crown's band: out past the lantern's fins, all round
  const C = f.plan("c", f.crown, 0.04 - (FIN.d + 0.15) / w);
  C.forEach((a, i) => {
    const b = C[(i + 1) % C.length];
    quad(V(a[0], f.crown + 0.6, a[1]), V(b[0], f.crown + 0.6, b[1]), V(b[0], h - LID - 0.4, b[1]), V(a[0], h - LID - 0.4, a[1]), -2, -2);
  });
  const g = new BufferGeometry();
  g.setAttribute("position", new Float32BufferAttribute(pos, 3));
  g.setAttribute("aU", new Float32BufferAttribute(us, 1));
  g.computeBoundingSphere();
  return g;
}
/* the transfer's light: the lobby's band and the crown's lit whole, the strip lit round its spark with a trail behind it, the way it runs */
function transferMaterial() {
  const u = { uBand: { value: 0 }, uCrown: { value: 0 }, uSpark: { value: -1 }, uDir: { value: 1 }, uBandColor: { value: new Color() }, uCrownColor: { value: new Color() }, uSparkColor: { value: new Color() } };
  const m = new ShaderMaterial({
    uniforms: u,
    vertexShader: /* glsl */ `
      attribute float aU;
      varying float vU;
      void main() {
        vU = aU;
        gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
      }`,
    fragmentShader: /* glsl */ `
      uniform float uBand;
      uniform float uCrown;
      uniform float uSpark;
      uniform float uDir;
      uniform vec3 uBandColor;
      uniform vec3 uCrownColor;
      uniform vec3 uSparkColor;
      varying float vU;
      void main() {
        float a;
        vec3 c;
        if ( vU < -1.5 ) {
          a = uCrown;
          c = uCrownColor;
        } else if ( vU < -0.5 ) {
          a = uBand;
          c = uBandColor;
        } else {
          float d = ( uSpark - vU ) * uDir;
          a = uSpark < -0.5 ? 0.0 : exp( -pow( d / 0.06, 2.0 ) ) + ( d > 0.0 ? 0.65 * exp( -d / 0.22 ) : 0.0 );
          c = mix( uBandColor, uSparkColor, clamp( a, 0.0, 1.0 ) );
        }
        if ( a < 0.01 ) discard;
        gl_FragColor = vec4( c, clamp( a, 0.0, 1.0 ) );
        #include <colorspace_fragment>
      }`,
    transparent: true,
    depthWrite: false,
    side: DoubleSide,
    toneMapped: false,
  });
  return { m, u };
}

/* the P wing's glass, deck and letter in one: slate glass that shines, takes the sky at a glance (Lighting.tsx), glows a little at night, carries a steel hairline at each floor, and lights a storey blue as a tx lands, the whole wing as a transfer leaves it or reaches it; the roof's deck, and the letter set into it. aKind is the storey, or -1 on the deck and -2 on the letter */
function pGlassMaterial(rise: { value: number }) {
  const u = {
    uTime: TIME,
    uRiseAt: rise,
    uFlash: { value: new Array<number>(P_MAX).fill(0) },
    uAll: { value: 0 },
    uFlashColor: { value: new Color() },
    uGlow: { value: new Color() },
    uBandC: { value: new Color() },
    uBandGlow: { value: 0 },
    uDeck: { value: new Color() },
    uMarkC: { value: new Color() },
    uLit: { value: 0 },
  };
  const m = new MeshPhongMaterial({ color: 0xffffff, shininess: 90 });
  m.onBeforeCompile = (s) => {
    Object.assign(s.uniforms, u);
    s.vertexShader = s.vertexShader
      .replace("#include <common>", `#include <common>\nuniform float uTime;\nuniform float uRiseAt;\nuniform float uFlash[ ${P_MAX} ];\nuniform float uAll;\nattribute float aKind;\nvarying float vKind;\nvarying float vFlash;\nvarying float vY;`)
      .replace(
        "#include <begin_vertex>",
        `#include <begin_vertex>\nvY = position.y;\nfloat riseT = clamp( ( uTime - uRiseAt ) / ${RISE_S.toFixed(2)}, 0.0, 1.0 );\ntransformed.y = mix( -0.6, transformed.y, 1.0 - pow( 1.0 - riseT, 4.0 ) );\nvKind = aKind;\nvFlash = aKind > -0.5 ? max( uFlash[ int( aKind + 0.5 ) ], uAll ) : 0.0;`,
      );
    s.fragmentShader = s.fragmentShader
      .replace("#include <common>", "#include <common>\nuniform vec3 uFlashColor;\nuniform vec3 uGlow;\nuniform vec3 uBandC;\nuniform float uBandGlow;\nuniform vec3 uDeck;\nuniform vec3 uMarkC;\nuniform float uLit;\nvarying float vKind;\nvarying float vFlash;\nvarying float vY;")
      .replace(
        "#include <color_fragment>",
        /* glsl */ `#include <color_fragment>
// a steel hairline at each floor, never thinner than about a pixel
float bandD = abs( fract( vY / ${FLOOR.toFixed(1)} + 0.5 ) - 0.5 ) * ${FLOOR.toFixed(1)};
float bandW = fwidth( vY );
float bandH = max( ${P_HAIR.toFixed(2)}, bandW * 0.8 );
float band = vKind > -0.5 ? 1.0 - smoothstep( bandH - bandW * 0.5, bandH + bandW * 0.5, bandD ) : 0.0;
if ( vKind < -1.5 ) diffuseColor.rgb = uMarkC;
else if ( vKind < -0.5 ) diffuseColor.rgb = uDeck;
else diffuseColor.rgb = mix( diffuseColor.rgb, uBandC, band );`,
      )
      .replace("#include <lights_phong_fragment>", "#include <lights_phong_fragment>\nmaterial.specularStrength *= vKind < -0.5 ? 0.12 : 1.0 - 0.6 * band;")
      .replace("#include <emissivemap_fragment>", "#include <emissivemap_fragment>\nif ( vKind > -0.5 ) totalEmissiveRadiance += ( uGlow * uLit + uFlashColor * vFlash ) * ( 1.0 - band ) + uBandC * uBandGlow * uLit * band;")
      // the sky in the glass, strongest at a glance as the city's glass takes it; none on the deck
      .replace(
        "#include <envmap_fragment>",
        "#ifdef USE_ENVMAP\nspecularStrength *= vKind > -0.5 ? mix( 0.3, 1.0, pow( 1.0 - saturate( dot( normalize( vViewPosition ), normal ) ), 3.0 ) ) : 0.0;\n#endif\n#include <envmap_fragment>",
      );
  };
  m.customProgramCacheKey = () => "city3d-hub-p-glass";
  // a stronger sheen than the city's glass (a seventh), as dark glass shows the sky more
  m.userData.cityEnv = 0.3;
  return { m, u };
}

/* the C wing's glass: deep red panes between hairline mullions in the brand's red, each storey's colors its own (the Versions lens paints them as the city paints its glass), lighting in the city's wave, lighter at a pane's head, flashing white on the storeys its transactions light, a glow at night, and the sky at a glance as the city's glass takes it. Each vertex carries its storey (aK, the lantern the last), its face, how far across its face (aS) and up its pane (aV) it is, the face's length there, and the mullions' divisions of the face (none on the lantern, which its fins divide) */
function cGlassMaterial(rise: { value: number }) {
  const u = {
    uTime: TIME,
    uRiseAt: rise,
    uPane: { value: Array.from({ length: C_SLOTS }, () => new Color()) },
    uLine: { value: Array.from({ length: C_SLOTS }, () => new Color()) },
    uFl: { value: Array.from({ length: C_FLASHES }, () => new Vector4()) },
    uPlain: { value: new Color() },
    uFlashColor: { value: new Color("#FFFFFF") },
    uGlow: { value: 0 },
    uLineGlow: { value: 0 },
    uFlashGlow: { value: 0 },
    uLit: { value: 0 },
    uLive: { value: 0 },
  };
  const m = new MeshPhongMaterial({ color: 0xffffff, specular: new Color("#5A6070"), shininess: 90 });
  m.onBeforeCompile = (s) => {
    Object.assign(s.uniforms, u);
    s.vertexShader = s.vertexShader
      .replace(
        "#include <common>",
        /* glsl */ `#include <common>
uniform float uTime;
uniform float uRiseAt;
uniform vec3 uPane[ ${C_SLOTS} ];
uniform vec3 uLine[ ${C_SLOTS} ];
uniform vec4 uFl[ ${C_FLASHES} ];
uniform float uLive;
attribute float aK;
attribute float aFace;
attribute float aS;
attribute float aV;
attribute float aLen;
attribute float aDiv;
varying vec3 vPane;
varying vec3 vLine;
varying float vFlash;
varying float vS;
varying float vV;
varying float vLen;
varying float vDiv;`,
      )
      .replace(
        "#include <begin_vertex>",
        /* glsl */ `#include <begin_vertex>
float riseT = clamp( ( uTime - uRiseAt ) / ${RISE_S.toFixed(2)}, 0.0, 1.0 );
transformed.y = mix( -0.6, transformed.y, 1.0 - pow( 1.0 - riseT, 4.0 ) );
int slot = int( aK + 0.5 );
vPane = uPane[ slot ];
vLine = uLine[ slot ];
// a storey's flash, as the city's glass flashes: on at once, then dying away, once a period
float flash = 0.0;
for ( int i = 0; i < ${C_FLASHES}; i++ ) {
  vec4 f = uFl[ i ];
  if ( f.z > 0.0 && abs( aK - f.x ) < 0.5 && abs( aFace - f.y ) < 0.5 ) {
    float p = fract( ( uTime + f.w ) / f.z );
    flash = max( flash, p < 0.03 ? p / 0.03 : exp( -( p - 0.03 ) * 14.0 ) );
  }
}
vFlash = flash * uLive;
vS = aS;
vV = aV;
vLen = aLen;
vDiv = aDiv;`,
      );
    s.fragmentShader = s.fragmentShader
      .replace(
        "#include <common>",
        /* glsl */ `#include <common>
uniform vec3 uPlain;
uniform vec3 uFlashColor;
uniform float uGlow;
uniform float uLineGlow;
uniform float uFlashGlow;
uniform float uLit;
varying vec3 vPane;
varying vec3 vLine;
varying float vFlash;
varying float vS;
varying float vV;
varying float vLen;
varying float vDiv;`,
      )
      .replace(
        "#include <color_fragment>",
        /* glsl */ `#include <color_fragment>
// the mullions: a line at each of the face's divisions, heavier at its corners, never thinner than about a pixel
float q = vS * vDiv;
float fq = fract( q );
float mullD = min( fq, 1.0 - fq ) * vLen / max( vDiv, 1.0 );
float mullF = fwidth( mullD );
float corner = min( 1.0, step( q, 0.5 ) + step( vDiv - 0.5, q ) );
float mullH = max( ${MULL_HALF.toFixed(2)} * mix( 1.0, ${CORNER.toFixed(1)}, corner ), mullF * 0.8 );
float mull = vDiv > 0.5 ? 1.0 - smoothstep( mullH - mullF * 0.5, mullH + mullF * 0.5, mullD ) : 0.0;
// the glass takes its colors as the city's lights come on, lighter at its head where it takes the sky, and white as a transaction lands
float lit = uLit >= 1.0 ? 1.0 : 1.0 - exp2( -10.0 * uLit );
vec3 pane = mix( uPlain, vPane, lit ) * mix( 0.93, 1.05, vV );
pane = mix( pane, uFlashColor, vFlash );
vec3 line = mix( uPlain, vLine, lit );
diffuseColor.rgb *= mix( pane, line, mull );`,
      )
      .replace("#include <emissivemap_fragment>", "#include <emissivemap_fragment>\ntotalEmissiveRadiance += ( pane * uGlow + uFlashColor * vFlash * uFlashGlow ) * ( 1.0 - mull ) + line * uLineGlow * mull;")
      // the sky in the glass, as the city's glass takes it (Schlick's Fresnel, 4% face on)
      .replace(
        "#include <envmap_fragment>",
        "#ifdef USE_ENVMAP\nspecularStrength *= 0.04 + 0.96 * pow( 1.0 - saturate( dot( normalize( vViewPosition ), normal ) ), 5.0 );\n#endif\n#include <envmap_fragment>",
      );
  };
  m.customProgramCacheKey = () => "city3d-hub-c-glass";
  // the sky's reflection (Lighting.tsx), as the city's glass takes it
  m.userData.cityEnv = 0.5;
  return { m, u };
}

/* a wing's steel over one run of storeys: a band at each floor, out past the glass, and, on the X wing, a mullion every so often along each face with a heavier post at each corner, each leaning with the wall */
function steelOf(g: Faces, f: Frame, key: WingKey, z0: number, z1: number, fins: boolean) {
  const c = f.centre(key);
  for (let y = Math.ceil(z0 / FLOOR) * FLOOR; y <= z1 + 0.01; y += FLOOR) {
    const B = f.plan(key, Math.min(y, z1), -BAND.out);
    g.prism(B, B, y - BAND.rise / 2, y + BAND.rise / 2, { bottom: true, c });
  }
  if (!fins) return;
  const P0 = f.plan(key, z0);
  const P1 = f.plan(key, z1);
  for (let i = 0; i < 8; i++) {
    const j = (i + 1) % 8;
    const { t, n, len } = runOf(P0[i], P0[j], c);
    const count = Math.max(0, Math.round(len / MULLION.every) - 1);
    for (let m = 0; m <= count; m++) {
      const u = m / (count + 1);
      const post = m === 0;
      g.fin([lerp(P0[i][0], P0[j][0], u), lerp(P0[i][1], P0[j][1], u)], [lerp(P1[i][0], P1[j][0], u), lerp(P1[i][1], P1[j][1], u)], z0, z1, t, n, post ? MULLION.post : MULLION.wd, post ? MULLION.d * 1.1 : MULLION.d);
    }
  }
}

/* the tower's massing, merged, each part in its own color: the forecourt, the stair, the podium, its fins, cornice and canopy; the C and X wings' cores and steel run by run, and every wing's lobbies; the C wing's lantern, fins, lid and spire; the X wing's roof, the P wing's roof and the beacon's mast; the bridges */
function massOf(w: number, h: number): BufferGeometry {
  const g = new Faces();
  const f = frameOf(w, h);
  // the forecourt's two steps, the stair up them and the podium's cornice, in stone
  g.paint(PAINT.stone);
  const steps = STEPS.map((r) => chamferOf(w * r, STEP_CUT));
  steps.forEach((P, i) => g.prism(P, P, i * STEP_H, (i + 1) * STEP_H));
  const base = STEP_H * STEPS.length;
  const sw = w * STAIR_W;
  const foot = steps[0][2][1] + 3.2;
  const head = steps[1][2][1];
  for (let s = 0; s < 8; s++) {
    const y0 = foot - ((foot - head) * s) / 8;
    g.box(0, 0, (y0 + head) / 2, sw * 2, (base * (s + 1)) / 8, y0 - head);
  }
  const pod = chamferOf(w * PODIUM_R, PODIUM_CUT);
  const cornice = chamferOf(w * PODIUM_R + 0.35, PODIUM_CUT);
  g.prism(cornice, cornice, PODIUM - 1.5, PODIUM, { bottom: true });
  // the podium's slate core behind its glass, its gray fins, and the canopy over the stair's head
  g.paint(PAINT.slate);
  const core = chamferOf(w * PODIUM_R - 0.6, PODIUM_CUT);
  g.prism(core, core, base, PODIUM - 1.5, { top: false });
  g.paint(PAINT.gray);
  pod.forEach((a, i) => {
    const b = pod[(i + 1) % pod.length];
    const { t, n, len } = runOf(a, b, [0, 0]);
    const count = Math.max(2, Math.round(len / 2.4));
    for (let m = 0; m < count; m++) {
      const p: Pt = [lerp(a[0], b[0], (m + 0.5) / count), lerp(a[1], b[1], (m + 0.5) / count)];
      g.fin(p, p, base, PODIUM - 1.5, t, n, 0.28, 0.5);
    }
  });
  g.box(0, CANOPY.at, pod[2][1] + CANOPY.out / 2, sw * 2.2, CANOPY.t, CANOPY.out);
  // the C wing's slate core and the X wing's pale one under their glass, run by run, with each one's steel; the P wing's glass is its own mesh (pGlassOf). Each lobby is set back over the run under it
  for (const key of ["c", "x", "p"] as WingKey[]) {
    const c = f.centre(key);
    if (key !== "p")
      for (const [z0, z1] of f.runsOf(key)) {
        g.paint(key === "c" ? PAINT.slate : PAINT.xCore);
        g.prism(f.plan(key, z0, 0.012), f.plan(key, z1, 0.012), z0, z1, { c });
        g.paint(key === "c" ? PAINT.cSteel : PAINT.xSteel);
        steelOf(g, f, key, z0, z1, key === "x");
      }
    g.paint(PAINT.slate);
    for (const z of f.lobbiesOf(key)) g.prism(f.plan(key, z, LOBBY_SET), f.plan(key, z + FLOOR, LOBBY_SET), z, z + FLOOR, { top: false, c });
  }
  // the C wing's lantern behind its close-set fins, its lid, and the spire on the roof's middle: a square footing, then an eight-sided mast narrowing to its tip
  const cc = f.centre("c");
  const Lc = f.plan("c", f.crown, 0.04);
  g.prism(Lc, Lc, f.crown, h - LID, { top: false, c: cc });
  g.paint(PAINT.cSteel);
  for (let i = 0; i < 8; i++) {
    const j = (i + 1) % 8;
    const { t, n, len } = runOf(Lc[i], Lc[j], cc);
    const count = Math.max(1, Math.round(len / FIN.every));
    for (let m = 0; m < count; m++) {
      const p: Pt = [lerp(Lc[i][0], Lc[j][0], m / count), lerp(Lc[i][1], Lc[j][1], m / count)];
      g.fin(p, p, f.crown, h - LID, t, n, FIN.wd, FIN.d);
    }
  }
  const lid = f.plan("c", f.crown, -0.045);
  g.prism(lid, lid, h - LID, h, { bottom: true, c: cc });
  g.box(cc[0], h, cc[1], SPIRE_FOOT[0], SPIRE_FOOT[1], SPIRE_FOOT[0], -Math.PI / 4);
  const ring = (r: number): Pt[] => Array.from({ length: 8 }, (_, i): Pt => [cc[0] + r * Math.cos(Math.PI / 8 + (i * Math.PI) / 4), cc[1] + r * Math.sin(Math.PI / 8 + (i * Math.PI) / 4)]);
  g.prism(ring(SPIRE_R[0]), ring(SPIRE_R[1]), h + SPIRE_FOOT[1], h + SPIRE_FOOT[1] + SPIRE_H, { c: cc });
  // the X wing's roof in its pale steel; the P wing's roof in slate, its top the deck (pGlassOf), and the beacon's mast at its back corner
  g.paint(PAINT.xSteel);
  const xr = f.roof("x");
  g.prism(xr, xr, f.top.x, f.top.x + ROOF_SLAB, { c: f.centre("x"), bottom: true });
  g.paint(PAINT.slate);
  const pr = f.roof("p");
  g.prism(pr, pr, f.top.p, f.top.p + ROOF_SLAB, { c: f.centre("p"), top: false, bottom: true });
  const back = pr.reduce((a, b) => (b[1] < a[1] ? b : a));
  g.box(back[0], f.top.p + ROOF_SLAB, back[1] + 1.4, 0.4, BEACON_MAST, 0.4);
  // the bridges: a gray deck and roof between the wings, a slate box between them behind the glass
  for (const br of BRIDGES)
    for (const li of br.at) {
      const z = f.lobbies[li];
      const b = bridgeOf(f, br.a, br.b, z);
      const [mx, mz] = [(b.ca[0] + b.cb[0]) / 2, (b.ca[1] + b.cb[1]) / 2];
      g.paint(PAINT.gray);
      g.box(mx, z + 0.6, mz, BRIDGE_W, 0.8, b.len, b.yaw);
      g.box(mx, z + FLOOR - 1.4, mz, BRIDGE_W + 0.4, 0.8, b.len, b.yaw);
      g.paint(PAINT.slate);
      g.box(mx, z + 1.4, mz, BRIDGE_W - 0.4, FLOOR - 2.8, b.len, b.yaw);
    }
  return g.build();
}

/* the P wing's slate glass, storey by storey, a ledge over each run under a lobby, the deck that is its roof's top, and the P-Chain's letter set into the deck, upright to the plate's front */
function pGlassOf(w: number, h: number): BufferGeometry {
  const g = new Faces();
  const f = frameOf(w, h);
  const cp = f.centre("p");
  f.pStoreys.forEach(([z0, z1], i) => {
    g.kind = Math.min(i, P_MAX - 1);
    g.prism(f.plan("p", z0, 0.004), f.plan("p", z1, 0.004), z0, z1, { top: false, c: cp });
  });
  g.kind = -1;
  for (const [, z1] of f.runsOf("p")) if (z1 < f.top.p) g.cap(f.plan("p", z1, 0.004), z1, 1);
  const y = f.top.p + ROOF_SLAB;
  g.cap(f.roof("p"), y, 1);
  g.kind = -2;
  const s = w * LETTER;
  const glyph = new Shape();
  glyph.moveTo(-1.6 * s, -2.4 * s);
  glyph.lineTo(-0.5 * s, -2.4 * s);
  glyph.lineTo(-0.5 * s, -0.3 * s);
  glyph.lineTo(0.3 * s, -0.3 * s);
  glyph.absarc(0.3 * s, 1.05 * s, 1.35 * s, -Math.PI / 2, Math.PI / 2, false);
  glyph.lineTo(-1.6 * s, 2.4 * s);
  glyph.closePath();
  const hole = new Shape();
  hole.moveTo(-0.5 * s, 0.55 * s);
  hole.lineTo(0.3 * s, 0.55 * s);
  hole.absarc(0.3 * s, 1.05 * s, 0.5 * s, -Math.PI / 2, Math.PI / 2, false);
  hole.lineTo(-0.5 * s, 1.55 * s);
  hole.closePath();
  glyph.holes.push(hole);
  const sg = new ShapeGeometry(glyph, 10);
  const p = sg.getAttribute("position");
  const idx = sg.getIndex();
  const at = (i: number) => V(cp[0] + p.getX(i), y + 0.06, cp[1] - p.getY(i));
  for (let t = 0; idx && t < idx.count; t += 3) g.tri(at(idx.getX(t)), at(idx.getX(t + 1)), at(idx.getX(t + 2)), V(0, 1, 0));
  sg.dispose();
  return g.build(true);
}

/* the C wing's glass: a pane a storey tall on each of its eight faces, storey by storey up each run, just proud of its core, and the lantern's all round; each face divided for its mullions as its run's foot divides it */
function cGlassOf(w: number, h: number): BufferGeometry {
  const f = frameOf(w, h);
  const c = f.centre("c");
  const pos: number[] = [];
  const nrm: number[] = [];
  const attrs: Record<"aK" | "aFace" | "aS" | "aV" | "aLen" | "aDiv", number[]> = { aK: [], aFace: [], aS: [], aV: [], aLen: [], aDiv: [] };
  // one face's pane, wall i from plan P0 at y0 to plan P1 at y1, turned to face out
  const pane = (P0: Pt[], P1: Pt[], y0: number, y1: number, i: number, k: number, div: number) => {
    const j = (i + 1) % P0.length;
    const a0 = V(P0[i][0], y0, P0[i][1]);
    const b0 = V(P0[j][0], y0, P0[j][1]);
    const a1 = V(P1[i][0], y1, P1[i][1]);
    const b1 = V(P1[j][0], y1, P1[j][1]);
    const n = new Vector3().subVectors(b0, a0).cross(new Vector3().subVectors(a1, a0)).normalize();
    const mid = a0.clone().add(b0).multiplyScalar(0.5);
    const flip = n.x * (mid.x - c[0]) + n.z * (mid.z - c[1]) < 0;
    if (flip) n.negate();
    const [l0, l1] = [a0.distanceTo(b0), a1.distanceTo(b1)];
    const corners: [Vector3, number, number, number][] = [
      [a0, 0, 0, l0],
      [b0, 1, 0, l0],
      [b1, 1, 1, l1],
      [a1, 0, 1, l1],
    ];
    for (const o of flip ? [0, 2, 1, 0, 3, 2] : [0, 1, 2, 0, 2, 3]) {
      const [v, s, t, len] = corners[o];
      pos.push(v.x, v.y, v.z);
      nrm.push(n.x, n.y, n.z);
      attrs.aK.push(k);
      attrs.aFace.push(i);
      attrs.aS.push(s);
      attrs.aV.push(t);
      attrs.aLen.push(len);
      attrs.aDiv.push(div);
    }
  };
  const out = -PROUD / w;
  const runs = f.runsOf("c");
  // the mullions' divisions of each face, as its run's foot has room for them
  const divs = runs.map(([z0]) => {
    const P = f.plan("c", z0);
    return P.map((a, i) => Math.max(1, Math.round(Math.hypot(P[(i + 1) % 8][0] - a[0], P[(i + 1) % 8][1] - a[1]) / MULLION.every)));
  });
  for (const { k, run, y0, y1 } of f.cStoreys) {
    const [P0, P1] = [f.plan("c", y0, out), f.plan("c", y1, out)];
    for (let i = 0; i < 8; i++) pane(P0, P1, y0, y1, i, k, divs[run][i]);
  }
  const L = f.plan("c", f.crown, 0.04 + out);
  for (let i = 0; i < 8; i++) pane(L, L, f.crown + 0.5, h - LID - 0.5, i, C_TOP, 0);
  const g = new BufferGeometry();
  g.setAttribute("position", new Float32BufferAttribute(pos, 3));
  g.setAttribute("normal", new Float32BufferAttribute(nrm, 3));
  for (const [name, a] of Object.entries(attrs)) g.setAttribute(name, new Float32BufferAttribute(a, 1));
  g.computeBoundingSphere();
  return g;
}

/** the meshes the tower draws on a half-width w and a height h, rising at `rise`: its massing, the C and P wings' glass, its lights (the spire's aircraft light, the beacon, the transfers' lights), and the transfer's path, drawn only while one plays; and the boxes the cursor catches */
export function hubTowerParts(w: number, h: number, rise: { value: number }) {
  const f = frameOf(w, h);
  const mass = massMaterial({ perInstance: false, riseAt: rise, key: "hub-tower", foot: 0.9 });
  // each part of the massing in its own color, which the theme tints
  mass.vertexColors = true;
  const body = new Mesh(massOf(w, h), mass);
  body.castShadow = true;
  body.receiveShadow = true;
  body.customDepthMaterial = riseDepth(false, rise);
  const cc = f.centre("c");
  const cMat = cGlassMaterial(rise);
  const cGlass = new Mesh(cGlassOf(w, h), cMat.m);
  cGlass.receiveShadow = true;
  const pMat = pGlassMaterial(rise);
  const pGlass = new Mesh(pGlassOf(w, h), pMat.m);
  pGlass.castShadow = true;
  pGlass.receiveShadow = true;
  pGlass.customDepthMaterial = riseDepth(false, rise);
  // the lights: the spire's aircraft light, the beacon, and eight transfers' lights
  const lights = new InstancedMesh(new IcosahedronGeometry(1, 1), new MeshBasicMaterial({ color: 0xffffff, toneMapped: false }), 10);
  lights.frustumCulled = false;
  lights.instanceMatrix.setUsage(DynamicDrawUsage);
  for (let i = 0; i < 10; i++) {
    lights.setMatrixAt(i, new Matrix4().makeScale(0, 0, 0));
    lights.setColorAt(i, new Color(1, 1, 1));
  }
  const back = f.roof("p").reduce((a, b) => (b[1] < a[1] ? b : a));
  const run = bridgeOf(f, "p", "c", f.lobbies[1]);
  // the transfer's path on the C wing, over the glass, casting nothing; and where its light climbs, from the lobby to the lantern
  const flowMat = transferMaterial();
  const flow = new Mesh(transferOf(w, h), flowMat.m);
  flow.visible = false;
  flow.renderOrder = 2;
  const spine = spineOf(f);
  const climb = Array.from({ length: 25 }, (_, i) => spine.at(lerp(spine.z0, spine.z1, i / 24), 0.5, 1.6));
  // what the cursor catches: each wing's own box, the podium the C-Chain's
  const pickMat = new MeshBasicMaterial({ visible: false });
  const pickOf = (key: WingKey, top: number) => {
    const c = f.centre(key);
    const r = w * WINGS[key].size * 1.42;
    return new Mesh(new BoxGeometry(r, top, r).translate(0, top / 2, 0).rotateY(-Math.PI / 4).translate(c[0], 0, c[1]), pickMat);
  };
  const picks = { c: pickOf("c", h + 20), p: pickOf("p", f.top.p + 10), x: pickOf("x", f.top.x + 4), base: new Mesh(new CylinderGeometry(w * PODIUM_R, w * STEPS[0], PODIUM, 16).translate(0, PODIUM / 2, 0), pickMat) };
  return {
    body,
    mass,
    cGlass,
    cMat,
    cStoreys: f.cStoreys.map((s) => s.k),
    pGlass,
    pMat,
    storeys: f.pStoreys.length,
    lights,
    aircraft: V(cc[0], h + HUB_REACH - AIRCRAFT_R, cc[1]),
    beacon: V(back[0], f.top.p + ROOF_SLAB + BEACON_MAST + 0.5, back[1] + 1.4),
    run: { from: V(run.from[0], f.lobbies[1] + 3, run.from[1]), to: V(run.to[0], f.lobbies[1] + 3, run.to[1]), yaw: run.yaw },
    climb,
    flow,
    flowMat,
    picks,
    meshes: [body, cGlass, pGlass, lights, flow],
  };
}
type Parts = ReturnType<typeof hubTowerParts>;

/** the tower's colors in a theme: its stone and steel as they are by day, tinted to the night; the C wing's two reds, or each storey's own under the Versions lens, as the city paints its glass (floors); the P wing's slate and its blue */
export function tintHubTower(parts: Parts, theme: Theme, floors: Glass[] = ["downtown"]) {
  const dark = theme === "dark";
  const t = dark ? 1 : 0;
  parts.mass.color.set(TINT[t]);
  (parts.mass.userData.foot as { value: number }).value = dark ? 0.8 : 0.9;
  // each storey's glass: downtown's two reds, or the city's color for its storey and the city's frame
  const c = parts.cMat.u;
  for (let k = 0; k < C_SLOTS; k++) {
    const g: Glass = !floors.length ? "plain" : floors[k === C_TOP ? floors.length - 1 : Math.min(k, floors.length - 1)];
    const own = g === "downtown";
    c.uPane.value[k].set(own ? C_GLASS.pane[t] : GLASS3[g][theme]);
    c.uLine.value[k].set(own ? C_GLASS.mullion[t] : MASS3.frame[theme]);
  }
  c.uPlain.value.set(GLASS3.plain[theme]);
  c.uGlow.value = C_GLASS.glow[t];
  c.uLineGlow.value = C_GLASS.mullionGlow[t];
  c.uFlashGlow.value = C_GLASS.flashGlow[t];
  const p = parts.pMat;
  p.m.color.set(P_GLASS.glass[t]);
  p.m.specular.set(P_GLASS.specular[t]);
  p.u.uGlow.value.set(P_GLASS.glow[t]);
  p.u.uBandC.value.set(P_GLASS.band[t]);
  p.u.uBandGlow.value = P_GLASS.bandGlow[t];
  // a tx's blue is a hint by day and plain at night
  p.u.uFlashColor.value.set(P_GLASS.flash[t]).multiplyScalar(dark ? 1 : DAY_FLASH);
  p.u.uDeck.value.set(P_GLASS.deck[t]);
  p.u.uMarkC.value.set(P_GLASS.mark[t]);
  // a transfer lights the lobby in the brand's blue and flashes the crown's band in its light red
  parts.flowMat.u.uBandColor.value.copy(dark ? BLUE.night : BLUE.day);
  parts.flowMat.u.uCrownColor.value.copy(RED.night);
}

/** the C wing's flashes, laid as the city lays a set's (City3D's flashesOf, with the same dice): the busier the C-Chain in the city's window, the more of its storeys flash and the more often, each on a face the eye sees; none while the city is still */
export function flashHubTower(parts: Parts, hub: Building, activity: Map<string, number> | null, still: boolean) {
  const slots = parts.cMat.u.uFl.value;
  for (const s of slots) s.set(0, 0, 0, 0);
  const a = activity?.get(hub.id) ?? 0;
  if (!activity || still || a <= 0) return;
  const top = Math.log10(1 + Math.max(1, ...activity.values()));
  const t = Math.log10(1 + a) / top;
  const ms = Math.round(5200 - 3700 * t);
  const roll = diceOf(hub.id);
  const ks = parts.cStoreys;
  const [k0, k1] = [Math.min(...ks), Math.max(...ks)];
  let n = 0;
  for (let i = 0, count = 1 + Math.round(t * 5); i < count && n < C_FLASHES; i++) {
    const k = k0 + Math.floor(roll() * (k1 - k0 + 1));
    const face = roll() < 0.5 ? 0 : 1;
    const delay = Math.round(roll() * ms);
    if (!ks.includes(k)) continue;
    // one flash to a window, the last laid on it winning, as the city's glass keeps
    const f = face + (k % 2) * 2;
    const same = slots.slice(0, n).findIndex((s) => s.x === k && s.y === f);
    slots[same >= 0 ? same : n++].set(k, f, ms / 1000, delay / 1000);
  }
}

/* a transfer's beats at s seconds in: where its light is across the bridge (0 at the P wing, 1 at the C wing, or -1) and up the C wing's spine (0 at the lobby, 1 at the lantern, or -1); how lit the lobby, the crown's band and the P wing are. Out of the P-Chain it plays from the P wing to the crown, into it from the crown to the P wing; each light comes on fast and fades long, and each run starts fast and settles */
function beatsOf(s: number, toC: boolean) {
  const on = (u: number) => u >= 0 && u <= 1;
  if (toC) {
    const up = (s - CROSS_S) / SPARK_S;
    return {
      cross: on(s / CROSS_S) ? expoOut(s / CROSS_S) : -1,
      band: pulseOf(s - CROSS_S * 0.9, 0.1, BAND_S),
      spark: on(up) ? expoOut(up) : -1,
      crown: pulseOf(s - CROSS_S - SPARK_S * 0.85, 0.08, CROWN_S),
      beacon: pulseOf(s, 0.08, BEACON_S),
    };
  }
  const down = (s - 0.3) / SPARK_S;
  const t0 = 0.3 + SPARK_S;
  const across = (s - t0) / CROSS_S;
  return {
    cross: on(across) ? 1 - expoOut(across) : -1,
    band: pulseOf(s - t0 + 0.05, 0.1, BAND_S),
    spark: on(down) ? 1 - expoOut(down) : -1,
    crown: pulseOf(s, 0.08, CROWN_S),
    beacon: pulseOf(s - t0 - CROSS_S * 0.9, 0.08, BEACON_S),
  };
}

/* the scratch the frames reuse, so a frame makes nothing new */
const WHITE = new Color("#FFFFFF");
const _m = new Matrix4();
const _q = new Quaternion();
const _p = new Vector3();
const _s = new Vector3();
const _c = new Color();
const _n = new Quaternion();

/** the tower's motion, frame by frame: the C wing's glass as the lights come on, the aircraft light, the beacon, the P-Chain's storeys and each transfer's play */
export function stepHubTower(parts: Parts, o: { dark: boolean; still: boolean; riseAt: number; lightAt: number; flashes: { storey: number; at: number }[]; runs: { at: number; out: boolean }[] }) {
  const t = TIME.value;
  const lit = o.still ? 1 : clamp01((t - o.lightAt) / 1.1);
  parts.pMat.u.uLit.value = lit;
  parts.cMat.u.uLit.value = lit;
  // the C wing's flashes run once its lights are on, as the city's run once it stands
  parts.cMat.u.uLive.value = o.still || lit < 1 ? 0 : 1;
  const blue = o.dark ? BLUE.night : BLUE.day;
  const red = o.dark ? RED.night : RED.day;
  // the transfers now playing: the strongest of their beats on the lobby, the crown and the P wing, and the newest spark
  let band = 0;
  let crown = 0;
  let signal = 0;
  let spark = -1;
  let dir = 1;
  const beats = o.runs.map((r) => {
    const s = t - r.at;
    const k = s >= 0 && s < TRANSFER_S ? beatsOf(s, r.out) : null;
    if (k) {
      band = Math.max(band, k.band);
      crown = Math.max(crown, k.crown);
      signal = Math.max(signal, k.beacon);
      if (k.spark >= 0) {
        spark = k.spark;
        dir = r.out ? 1 : -1;
      }
    }
    return k;
  });
  const fu = parts.flowMat.u;
  fu.uBand.value = band * 0.9;
  fu.uCrown.value = crown;
  fu.uSpark.value = spark;
  fu.uDir.value = dir;
  // the spark is the brand's blue, pale, so it reads on the C wing's red; the crown's band answers in red
  fu.uSparkColor.value.copy(blue).lerp(WHITE, o.dark ? 0.4 : 0.25);
  parts.flow.visible = band > 0.01 || crown > 0.01 || spark >= 0;
  // the whole P wing lights as a transfer leaves it or reaches it
  parts.pMat.u.uAll.value = signal * 0.7;
  const up = o.still ? 1 : clamp01((t - o.riseAt - RISE_S * 0.8) / 0.5);
  // each P storey's flash: the brightest of the txs that light it, on fast and fading long
  const fl = parts.pMat.u.uFlash.value;
  fl.fill(0);
  for (const f of o.flashes) {
    const k = pulseOf(t - f.at, FLASH_IN, FLASH_S);
    if (k <= 0) continue;
    const i = f.storey % Math.max(1, parts.storeys);
    fl[i] = Math.max(fl[i], k);
  }
  // the spire's aircraft light: a short red blink every two seconds, the way a tower's light keeps time
  const L = parts.lights;
  const blink = o.still ? 1 : 0.12 + 0.88 * pulseOf(t % 2, 0.06, 0.9);
  L.setMatrixAt(0, _m.compose(parts.aircraft, _n.identity(), _s.setScalar(AIRCRAFT_R * up)));
  L.setColorAt(0, _c.copy(red).multiplyScalar((o.dark ? 1.8 : 1.2) * blink));
  // the beacon: small and blue, a hint by day and plain at night, and a flare as a transfer leaves the P wing or reaches it
  const beat = o.still ? 1 : 0.35 + 0.65 * Math.max(0, Math.sin(t * 2.4)) ** 6;
  L.setMatrixAt(1, _m.compose(parts.beacon, _n.identity(), _s.setScalar(0.6 * up * (1 + 1.8 * signal))));
  L.setColorAt(1, _c.copy(blue).multiplyScalar((o.dark ? 0.6 + 1.2 * beat : 0.4 + 0.3 * beat) + (o.dark ? 2.2 : 1.5) * signal));
  // each transfer's light, in the brand's blue: across the bridge, then up the spine (or down it, into the P-Chain)
  _q.setFromAxisAngle(_p.set(0, 1, 0), parts.run.yaw);
  for (let i = 0; i < 8; i++) {
    const k = beats[i];
    if (k && k.cross >= 0) {
      _p.copy(parts.run.from).lerp(parts.run.to, k.cross);
      const swell = 0.75 + 0.5 * Math.sin(k.cross * Math.PI);
      L.setMatrixAt(2 + i, _m.compose(_p, _q, _s.set(swell, swell, swell * 2.4)));
      L.setColorAt(2 + i, _c.copy(blue).multiplyScalar(o.dark ? 1.6 : 1.1));
    } else if (k && k.spark >= 0) {
      const u = k.spark;
      const j = Math.min(parts.climb.length - 2, Math.floor(u * (parts.climb.length - 1)));
      _p.copy(parts.climb[j]).lerp(parts.climb[j + 1], u * (parts.climb.length - 1) - j);
      L.setMatrixAt(2 + i, _m.compose(_p, _n.identity(), _s.setScalar(2)));
      L.setColorAt(2 + i, _c.copy(blue).lerp(WHITE, o.dark ? 0.4 : 0.25).multiplyScalar(o.dark ? 1.8 : 1.3));
    } else L.setMatrixAt(2 + i, _m.makeScale(0, 0, 0));
  }
  L.instanceMatrix.needsUpdate = true;
  if (L.instanceColor) L.instanceColor.needsUpdate = true;
}

export function HubTower({
  hub,
  riseAt,
  lightAt,
  floors,
  theme,
  still,
  pulse = null,
  activity = null,
  onPick,
  onHover,
}: {
  hub: Building;
  riseAt: number;
  lightAt: number;
  /** each storey's glass as the city paints it: downtown's, or the Versions lens's colors, which the C wing's glass takes */
  floors: Glass[];
  theme: Theme;
  /** the city's mono face; the tower carries no words of its own now */
  font?: string;
  still: boolean;
  /** the P-Chain's ledger: each tx that lands lights a storey of the P wing, and each import or export plays a transfer */
  pulse?: PchainPulse | null;
  /** each set's transactions in the city's window, by id, as the city's flashes read them: the C wing's storeys flash with the C-Chain's */
  activity?: Map<string, number> | null;
  /** a wing picked: the tower's id for the C and X wings and the podium, PCHAIN_PICK for the P wing */
  onPick?: (id: string) => void;
  onHover?: (id: string | null) => void;
}) {
  const dark = theme === "dark";
  const w = hub.n.w;
  const h = hub.n.h;
  const rise = useMemo(() => ({ value: riseAt }), [riseAt]);
  const parts = useMemo(() => hubTowerParts(w, h, rise), [w, h, rise]);
  useEffect(
    () => () => {
      for (const o of [...parts.meshes, ...Object.values(parts.picks)]) o.geometry.dispose();
      parts.lights.dispose();
    },
    [parts],
  );
  useEffect(() => tintHubTower(parts, theme, floors), [parts, theme, floors]);
  useEffect(() => flashHubTower(parts, hub, activity, still), [parts, hub, activity, still]);

  /* each P-Chain tx that lands lights the next storey of the P wing up; an import or an export plays a transfer; a burst plays a beat apart */
  const seen = useRef<Set<string> | null>(null);
  const flashes = useRef<{ storey: number; at: number }[]>([]);
  const runs = useRef<{ at: number; out: boolean }[]>([]);
  const turn = useRef(0);
  const runOut = (out: boolean, at: number) => {
    runs.current = [...runs.current.filter((r) => r.at + TRANSFER_S > TIME.value), { at, out }].slice(-8);
  };
  useEffect(() => {
    if (!pulse) return;
    if (!seen.current) {
      seen.current = new Set(pulse.txs.map((t) => t.hash));
      return;
    }
    let lag = 0;
    for (const t of [...pulse.txs].reverse()) {
      if (seen.current.has(t.hash)) continue;
      seen.current.add(t.hash);
      if (!t.fresh || still) continue;
      const at = TIME.value + lag;
      flashes.current = [...flashes.current.filter((f) => f.at + FLASH_S > TIME.value), { storey: turn.current++, at }];
      if (t.type === "ImportTx" || t.type === "ExportTx") runOut(t.type === "ExportTx", at);
      lag += 0.3;
    }
  }, [pulse, still]);
  useFrame(() => {
    while (asked.length) {
      const dir = asked.shift();
      if (!still) runOut(dir === "toC", TIME.value);
    }
    stepHubTower(parts, { dark, still, riseAt, lightAt, flashes: flashes.current, runs: runs.current });
  });

  const pick = (id: string) => (e: ThreeEvent<MouseEvent>) => {
    if (e.delta > 6) return;
    e.stopPropagation();
    onPick?.(id);
  };
  const over = (id: string) => (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    onHover?.(id);
  };
  const out = () => onHover?.(null);
  return (
    <group position={[hub.x, hub.base, hub.z]}>
      {parts.meshes.map((o, i) => (
        <primitive key={i} object={o} />
      ))}
      {onPick &&
        (["c", "p", "x", "base"] as const).map((k) => (
          <primitive key={k} object={parts.picks[k]} onClick={pick(k === "p" ? PCHAIN_PICK : hub.id)} onPointerOver={over(k === "p" ? PCHAIN_PICK : hub.id)} onPointerOut={out} />
        ))}
    </group>
  );
}
