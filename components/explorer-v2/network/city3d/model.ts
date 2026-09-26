import { CITY_REACH, CX, CY, FLOOR, TALL, chamferOf, crestOf, formOf, outskirtsOf as mapOutskirts, partsOf, type Form, type Node, type Part } from "@/components/explorer-v2/network/icm-map";
import { STEPS, STEP_CUT } from "@/components/explorer-v2/network/hub-tower";
import { diceOf, TILT } from "@/components/explorer-v2/network/city-geometry";
import type { City } from "@/components/explorer-v2/network/city";
import type { Ground } from "@/components/explorer-v2/network/ground";
import type { Site } from "@/components/explorer-v2/network/newcomers";
import { hubWindows } from "./HubTower";

/* The city as a model in three dimensions, worked out once per plan: the
   map's plan (city.ts) and its buildings' forms (icm-map.tsx) stood up in
   the world's own frame. The plan's x is the world's x, its y (toward the
   viewer) the world's z, and a height is the world's y, all in the map's
   units, so a storey is still FLOOR tall. Each building is a list of
   parts, each part a box turned to the plate or a drum; its windows are
   ribbons of glass, a storey at a time, on every face; its roof carries
   the furniture the map draws on it. Pure: the scene draws what this
   returns. */

/** the blocks' curb: every lot stands this far over the streets */
export const BLOCK_H = 2;
/** the city's squares are turned a quarter of a right angle to the plate */
export const YAW = -Math.PI / 4;
/** how far a ribbon of glass stands off its wall */
const PROUD = 0.14;
const R2 = Math.SQRT2;

/** a screen point of the map in the plan: the map draws plan (x, y) at (CX + x, CY + y * TILT) */
export const planOf = (sx: number, sy: number): [number, number] => [sx - CX, (sy - CY) / TILT];

/** one instance of a unit shape: its base centre, its size, its turn and its lean */
export interface Inst {
  /** the building it belongs to, by index; -1 for the ground's */
  b: number;
  x: number;
  y: number;
  z: number;
  sx: number;
  sy: number;
  sz: number;
  yaw: number;
  pitch?: number;
}
/** what a ribbon's glass shows: its storey's, its building's top storey's, downtown's white light, or a sky lobby's warm one */
export type Tone = "floor" | "top" | "white" | "crown" | "lobby";
export interface Ribbon extends Inst {
  /** its storey, 0 on the ground */
  k: number;
  tone: Tone;
}
export interface Lamp {
  b: number;
  x: number;
  y: number;
  z: number;
  r: number;
  white: boolean;
  /** its blink, a beat and its offset in seconds; a beat of 0 breathes */
  beat: number;
  phase: number;
  breathe?: boolean;
}
export interface Tree {
  x: number;
  y: number;
  z: number;
  r: number;
  /** the building whose roof it grows on */
  b?: number;
}

export interface Building {
  id: string;
  n: Node;
  /** its ground point in the plan */
  x: number;
  z: number;
  /** the height it stands on: a block's curb, downtown's plaza */
  base: number;
  form: Form;
  parts: Part[];
  /** its massing's top, over its base */
  crest: number;
  /** its storeys, as the map counts them */
  storeys: number;
  /** its turn in the build-out, 0 first */
  rise: number;
  /** when its windows come on after the city stands, in ms */
  light: number;
  /** its reach from its ground point in the plan, for the camera and the pick */
  extent: number;
  /** its shaft's windows by storey and face, for the floors its transactions light */
  shaft: Map<number, number[]>;
  /** its shaft's first and last lit storey */
  k0: number;
  k1: number;
}

export interface CityModel {
  buildings: Building[];
  byId: Map<string, number>;
  hub: number;
  boxes: Inst[];
  drums: Inst[];
  /** the flat ribbons of glass */
  ribbons: Ribbon[];
  /** the ribbons round the drums */
  bands: Ribbon[];
  caps: Inst[];
  domes: Inst[];
  greens: Inst[];
  tanks: Inst[];
  cones: Inst[];
  steel: Inst[];
  pads: Inst[];
  solar: Inst[];
  lamps: Lamp[];
  trees: Tree[];
}

/* how far in from a face's ends its glass stops, as a share of the face, as the map's glassInset */
function insetOf(l: number, r: number, face: 0 | 1): number {
  const short = Math.min(l, r);
  const run = face === 0 ? l : r;
  return Math.max(0.02, ((short < 10 ? 0.17 : 0.12) * short) / run);
}

/* the city rises from downtown out, the new L1s last, as the map's riseDelay */
function riseDelay(n: Node): number {
  if (n.newAt !== null) return Date.now() / 1000 - n.newAt < 600 ? 900 : 2400 + n.newRank * 320;
  return n.role === "hub" ? 0 : 140 + n.reach * 1100;
}

/** a set's turn in the wave the windows come on in, ms after the city stands, as the map's */
export const lightDelayOf = (n: Node) => Math.round(60 + (Math.hypot(n.x - CX, (n.y - CY) / TILT) / CITY_REACH) * 1600 + diceOf(`${n.id}:light`)() * 260);

/* a horizontal turn's heading, as the yaw that faces a plane's front along it */
const yawOf = (nx: number, nz: number) => Math.atan2(nx, nz);

/* a box part's four faces: the outward normal, the face's length, its half-depth from the centre, and its glass's inset */
function facesOf(l: number, r: number) {
  const s = Math.sin(YAW);
  const c = Math.cos(YAW);
  // local +z is the map's left face, local +x its right face
  const left: [number, number] = [s, c];
  const right: [number, number] = [c, -s];
  const t0 = insetOf(l, r, 0);
  const t1 = insetOf(l, r, 1);
  return [
    { n: left, len: l * R2, depth: (r * R2) / 2, t: t0 },
    { n: right, len: r * R2, depth: (l * R2) / 2, t: t1 },
    { n: [-left[0], -left[1]] as [number, number], len: l * R2, depth: (r * R2) / 2, t: t0 },
    { n: [-right[0], -right[1]] as [number, number], len: r * R2, depth: (l * R2) / 2, t: t1 },
  ];
}

export function modelOf(nodes: Node[]): CityModel {
  const m: CityModel = {
    buildings: [],
    byId: new Map(),
    hub: -1,
    boxes: [],
    drums: [],
    ribbons: [],
    bands: [],
    caps: [],
    domes: [],
    greens: [],
    tanks: [],
    cones: [],
    steel: [],
    pads: [],
    solar: [],
    lamps: [],
    trees: [],
  };
  // the three tallest after downtown are the skyline's landmarks, with spires
  const landmarks = new Set(
    nodes
      .filter((n) => n.role !== "hub" && n.h > TALL)
      .sort((a, b) => b.h - a.h)
      .slice(0, 3)
      .map((n) => n.id),
  );
  const order = new Map([...nodes].sort((a, b) => riseDelay(a) - riseDelay(b)).map((n, i) => [n.id, i]));
  nodes.forEach((n) => {
    const b = m.buildings.length;
    const [x, z] = planOf(n.x, n.y);
    const hub = n.role === "hub";
    // the roofs are restrained, as a presentation model's: half the water tanks stay, and every mast and leg is a fine steel line
    const drawn = formOf(n, landmarks.has(n.id));
    const form: Form = drawn.roof === "water" && diceOf(`${n.id}:tank`)() < 0.5 ? { ...drawn, roof: "flat" } : drawn;
    const parts = partsOf(n.w, n.h, form.kind, form.flip);
    const base = hub ? 0 : BLOCK_H;
    const building: Building = {
      id: n.id,
      n,
      x,
      z,
      base,
      form,
      parts,
      crest: hub ? n.h : crestOf(n.w, n.h, form),
      storeys: Math.max(1, Math.floor(n.h / FLOOR)),
      rise: order.get(n.id) ?? 0,
      light: lightDelayOf(n),
      extent: hub ? n.w * 1.8 : n.w * (form.kind === "slab" ? 1.35 : 1.05),
      shaft: new Map(),
      k0: 0,
      k1: -1,
    };
    m.byId.set(n.id, b);
    m.buildings.push(building);
    if (hub) {
      m.hub = b;
      hubWindows(m, building);
      return;
    }
    // the part whose floors the set's transactions light: its longest run, over any podium
    const shaftAt = parts.reduce((best, p, i) => (p.z1 <= n.h && p.z1 - p.z0 > parts[best].z1 - parts[best].z0 ? i : best), 0);
    const shaft = parts[shaftAt];
    building.k0 = Math.ceil((shaft.z0 - 1.3) / FLOOR);
    building.k1 = Math.floor((shaft.z1 - 5.3) / FLOOR);
    parts.forEach((p, pi) => {
      const px = x + (p.dx ?? 0);
      const pz = z + (p.dy ?? 0) / TILT;
      if (p.round) {
        m.drums.push({ b, x: px, y: base + p.z0, z: pz, sx: p.w, sy: p.z1 - p.z0, sz: p.w, yaw: 0 });
        for (let k = 0; k < building.storeys; k++) {
          const za = k * FLOOR + 1.8;
          if (za < p.z0 + 0.5 || za + 2.5 > p.z1 - 1) continue;
          if (pi === shaftAt) building.shaft.set(k, [-1 - m.bands.length]);
          m.bands.push({ b, x: px, y: base + za, z: pz, sx: p.w + PROUD, sy: 2.5, sz: p.w + PROUD, yaw: 0, k, tone: "floor" });
        }
        return;
      }
      const l = p.l ?? p.w;
      const r = p.r ?? p.w;
      m.boxes.push({ b, x: px, y: base + p.z0, z: pz, sx: l * R2, sy: p.z1 - p.z0, sz: r * R2, yaw: YAW });
      const faces = facesOf(l, r);
      for (let k = 0; k < building.storeys; k++) {
        const za = k * FLOOR + 1.8;
        const zb = za + 2.5;
        if (za < p.z0 + 0.5 || zb > p.z1 - 1) continue;
        const ids: number[] = [];
        for (const f of faces) {
          const d = f.depth + PROUD;
          ids.push(m.ribbons.length);
          m.ribbons.push({ b, x: px + f.n[0] * d, y: base + za, z: pz + f.n[1] * d, sx: f.len * (1 - 2 * f.t), sy: 2.5, sz: 1, yaw: yawOf(f.n[0], f.n[1]), k, tone: "floor" });
        }
        if (pi === shaftAt) building.shaft.set(k, ids);
      }
    });
    roofOf(m, building);
  });
  return m;
}

/* what stands on a building's roof, as the map's Building draws it */
function roofOf(m: CityModel, bd: Building) {
  const { form, parts, x, z, base } = bd;
  const b = m.buildings.indexOf(bd);
  const top = parts.reduce((a, p) => (p.z1 > a.z1 ? p : a));
  const tx = x + (top.dx ?? 0);
  const tz = z + (top.dy ?? 0) / TILT;
  const tw = Math.min(top.l ?? top.w, top.r ?? top.w);
  const y = base + top.z1;
  switch (form.roof) {
    case "cap":
      // a hipped roof, its slopes meeting over the middle
      m.caps.push({ b, x: tx, y, z: tz, sx: top.w, sy: top.w * 0.55, sz: top.w, yaw: 0 });
      break;
    case "penthouse": {
      // the plant room, set back on the roof
      const w = tw * 0.42;
      m.boxes.push({ b, x: tx + tw * 0.14, y, z: tz - tw * 0.3, sx: w * R2, sy: 6, sz: w * R2, yaw: YAW });
      break;
    }
    case "lantern": {
      // a glass lantern under a thin lid, in the building's top storey's glass
      const w = tw * 0.5;
      for (const f of facesOf(w, w)) {
        const d = f.depth + 0.02;
        m.ribbons.push({ b, x: tx + f.n[0] * d, y, z: tz + f.n[1] * d, sx: f.len, sy: 5, sz: 1, yaw: yawOf(f.n[0], f.n[1]), k: -1, tone: "top" });
      }
      m.boxes.push({ b, x: tx, y, z: tz, sx: w * R2 * 0.96, sy: 5, sz: w * R2 * 0.96, yaw: YAW });
      m.boxes.push({ b, x: tx, y: y + 5, z: tz, sx: tw * 0.58 * R2, sy: 1, sz: tw * 0.58 * R2, yaw: YAW });
      break;
    }
    case "water": {
      // a steel tank on its legs at the roof's back corner, under its cone
      const r = Math.max(1.4, tw * 0.2);
      const cx = tx - tw * 0.3;
      const cz = tz - tw * 0.15;
      for (const [dx, dz] of [
        [-r * 0.7, 0],
        [r * 0.7, 0],
        [0, r * 0.8],
      ]) {
        m.steel.push({ b, x: cx + dx, y, z: cz + dz, sx: 0.28, sy: 3, sz: 0.28, yaw: 0 });
      }
      m.tanks.push({ b, x: cx, y: y + 3, z: cz, sx: r, sy: 4.2, sz: r, yaw: 0 });
      m.cones.push({ b, x: cx, y: y + 7.2, z: cz, sx: r * 1.08, sy: r * 0.95, sz: r * 1.08, yaw: 0 });
      break;
    }
    case "helipad":
      // laid flat on the roof, in the roof's own frame: a unit there runs a diagonal's worth of the plan
      m.pads.push({ b, x: tx, y: y + 0.06, z: tz, sx: tw * 0.4 * R2, sy: 1, sz: tw * 0.4 * R2, yaw: YAW });
      break;
    case "solar":
      // three rows of panels, tilted to the sun
      for (const v of [-0.3, -0.04, 0.22]) {
        const c = (v + 0.08) * tw;
        m.solar.push({ b, x: tx - c, y: y + 0.4, z: tz + c, sx: tw * 0.76 * R2, sy: 0.3, sz: tw * 0.16 * R2 * 0.92, yaw: YAW, pitch: -0.28 });
      }
      break;
    case "mast": {
      // the roof's masts at its corners; the tall one lit
      const ha = 11 + tw * 0.35;
      const hb = 6 + tw * 0.2;
      const ax = tx - tw * 0.62;
      m.steel.push({ b, x: ax, y, z: tz, sx: 0.32, sy: ha, sz: 0.32, yaw: 0 });
      m.steel.push({ b, x: ax, y: y + ha * 0.62, z: tz, sx: 2.6, sy: 0.2, sz: 0.2, yaw: 0 });
      m.steel.push({ b, x: tx + tw * 0.58, y, z: tz + tw * 0.12, sx: 0.26, sy: hb, sz: 0.26, yaw: 0 });
      m.lamps.push({ b, x: ax, y: y + ha + 0.6, z: tz, r: 0.75, white: false, beat: 2.8, phase: diceOf(`${bd.id}:mast`)() * 2.8 });
      break;
    }
    case "dome":
      if (top.round) {
        m.domes.push({ b, x: tx, y, z: tz, sx: top.w, sy: top.w * 0.62, sz: top.w, yaw: 0 });
        m.steel.push({ b, x: tx, y: y + top.w * 0.62 - 0.3, z: tz, sx: 0.26, sy: 3.3, sz: 0.26, yaw: 0 });
      }
      break;
    case "garden": {
      // a roof garden: its green, three trees on it
      const w = top.l ?? top.w;
      const r = top.r ?? top.w;
      m.greens.push({ b, x: tx, y: y - 0.05, z: tz, sx: w * R2 * 0.94, sy: 0.35, sz: r * R2 * 0.94, yaw: YAW });
      for (const [dx, dz] of [
        [-0.4, -0.1],
        [0.28, 0.18],
        [0.02, -0.46],
      ]) {
        m.trees.push({ x: tx + tw * dx, y: y + 0.3, z: tz + tw * dz, r: Math.max(1, tw * 0.12), b });
      }
      break;
    }
  }
  if (form.kind === "spire") {
    // the landmark's mast off its crown's back corner, with its white light
    const mx = x + top.w * 0.35;
    const mz = z - top.w * 0.35;
    m.steel.push({ b, x: mx, y, z: mz, sx: 0.42, sy: 18, sz: 0.42, yaw: 0 });
    m.lamps.push({ b, x: mx, y: y + 18.7, z: mz, r: 1.05, white: true, beat: 3.2, phase: diceOf(`${bd.id}:spire`)() * 3.2 });
  }
}

/* the outskirts: the plate between the city's last ring and the ledger,
   laid out as the map lays them (icm-map.tsx): low plain blocks on their
   streets, a park here and there, and a building site for each L1 the
   P-Chain has created that runs no validators yet, out past the Frontier */
export interface Outskirts {
  pads: string[];
  parks: string[];
  fences: string[];
  masses: { x: number; z: number; w: number; h: number }[];
  trees: Tree[];
  sites: { site: Site; x: number; z: number; w: number }[];
}
export function outskirtsOf(city: City, sites: Site[], terrain: Ground): Outskirts {
  const o = mapOutskirts(city, sites, terrain);
  return {
    pads: o.pads,
    parks: o.parks,
    fences: o.fences,
    masses: o.masses.map((q) => {
      const [x, z] = planOf(q.x, q.y);
      return { x, z, w: q.w, h: q.h };
    }),
    trees: o.trees.map(([sx, sy]) => {
      const [x, z] = planOf(sx, sy);
      return { x, y: 0, z, r: 2.3 };
    }),
    sites: o.sites.map((q) => {
      const [x, z] = planOf(q.x, q.y);
      return { site: q.site, x, z, w: q.w };
    }),
  };
}

/** the ground's trees in the plan: on a block's lawn over its curb, else on the ground */
export function groundTrees(city: City, terrain: Ground): Tree[] {
  const inBlock = (x: number, z: number) => {
    const r = Math.hypot(x, z);
    const a = Math.atan2(z, x);
    return city.blocks.some((bl) => {
      if (r < bl.r0 || r > bl.r1) return false;
      const span = bl.a1 - bl.a0;
      const d = (((a - bl.a0) % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
      return d <= span;
    });
  };
  return terrain.trees.map(([sx, sy, r]) => {
    const [x, z] = planOf(sx, sy);
    return { x, y: inBlock(x, z) ? BLOCK_H : 0, z, r };
  });
}

/** each building's foot on its lot, for the soft shadow the ground paints round it */
export function feetOf(m: CityModel): { poly?: [number, number][]; round?: [number, number, number] }[] {
  const out: { poly?: [number, number][]; round?: [number, number, number] }[] = [];
  const onLot = (i: Inst) => i.b >= 0 && Math.abs(i.y - m.buildings[i.b].base) < 0.01;
  const ax: [number, number] = [Math.cos(YAW), -Math.sin(YAW)];
  const az: [number, number] = [Math.sin(YAW), Math.cos(YAW)];
  for (const i of m.boxes) {
    if (!onLot(i)) continue;
    const corner = (u: number, v: number): [number, number] => [i.x + ax[0] * u * i.sx * 0.5 + az[0] * v * i.sz * 0.5, i.z + ax[1] * u * i.sx * 0.5 + az[1] * v * i.sz * 0.5];
    out.push({ poly: [corner(-1, -1), corner(1, -1), corner(1, 1), corner(-1, 1)] });
  }
  for (const i of m.drums) if (onLot(i)) out.push({ round: [i.x, i.z, i.sx] });
  // downtown's foot is its forecourt's outer step
  const hub = m.buildings[m.hub];
  if (hub) out.push({ poly: chamferOf(hub.n.w * STEPS[0], STEP_CUT).map(([x, z]): [number, number] => [hub.x + x, hub.z + z]) });
  return out;
}

