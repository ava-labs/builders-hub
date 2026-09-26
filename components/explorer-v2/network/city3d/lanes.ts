import { CX, CY, type Route } from "@/components/explorer-v2/network/icm-map";
import { TILT } from "@/components/explorer-v2/network/city-geometry";
import { trafficLanes } from "@/components/explorer-v2/network/city-traffic";

/* The streets the 3D traffic drives, in the plan. Each route's path is the
   map's (icm-map.tsx), on screen; its legs are read back into the plan, a
   ring road's ellipse a circle again, and driven as the map's fleet drives
   them (city-traffic.tsx): to the right of each street's middle, one lane
   each way on a driveway and a ring road, three each way on a boulevard,
   each corner rounded off where the two lanes meet. Pure: the scene
   samples the lanes and paves the streets. */

type Pt = [number, number];
interface Leg {
  a: Pt;
  b: Pt;
  len: number;
  arc: { c: Pt; r: number; t0: number; dt: number } | null;
}

/* the route's legs in the traffic's frame: screen x, and screen y over the tilt */
function legsOf(d: string): Leg[] {
  const legs: Leg[] = [];
  let from: Pt | null = null;
  for (const [, cmd, rest] of d.matchAll(/([MLA])([^MLA]*)/g)) {
    const n = rest.trim().split(/[\s,]+/).map(Number);
    const to: Pt = [n[n.length - 2], n[n.length - 1] / TILT];
    const chord = from ? Math.hypot(to[0] - from[0], to[1] - from[1]) : 0;
    if (from && chord > 0.01 && cmd === "L") legs.push({ a: from, b: to, len: chord, arc: null });
    if (from && chord > 0.01 && cmd === "A") {
      const r = Math.max(n[0], chord / 2);
      const side = n[4] ? 1 : -1;
      const h = Math.sqrt(Math.max(0, r * r - (chord / 2) ** 2)) * side;
      const c: Pt = [(from[0] + to[0]) / 2 - ((to[1] - from[1]) / chord) * h, (from[1] + to[1]) / 2 + ((to[0] - from[0]) / chord) * h];
      const t0 = Math.atan2(from[1] - c[1], from[0] - c[0]);
      let dt = Math.atan2(to[1] - c[1], to[0] - c[0]) - t0;
      if (side > 0 && dt < 0) dt += 2 * Math.PI;
      if (side < 0 && dt > 0) dt -= 2 * Math.PI;
      legs.push({ a: from, b: to, len: r * Math.abs(dt), arc: { c, r, t0, dt } });
    }
    from = to;
  }
  return legs;
}

function pointOn(l: Leg, s: number): Pt {
  if (!l.arc) return [l.a[0] + ((l.b[0] - l.a[0]) * s) / l.len, l.a[1] + ((l.b[1] - l.a[1]) * s) / l.len];
  const { c, r, t0, dt } = l.arc;
  const t = t0 + (Math.sign(dt) * s) / r;
  return [c[0] + r * Math.cos(t), c[1] + r * Math.sin(t)];
}
function headingOn(l: Leg, s: number): Pt {
  if (!l.arc) return [(l.b[0] - l.a[0]) / l.len, (l.b[1] - l.a[1]) / l.len];
  const { r, t0, dt } = l.arc;
  const g = Math.sign(dt);
  const t = t0 + (g * s) / r;
  return [-Math.sin(t) * g, Math.cos(t) * g];
}
function meet(a: Pt, u: Pt, b: Pt, v: Pt): Pt | null {
  const den = u[0] * v[1] - u[1] * v[0];
  if (Math.abs(den) < 1e-3) return null;
  const s = ((b[0] - a[0]) * v[1] - (b[1] - a[1]) * v[0]) / den;
  return [a[0] + u[0] * s, a[1] + u[1] * s];
}
const add = (p: Pt, q: Pt, k = 1): Pt => [p[0] + q[0] * k, p[1] + q[1] * k];
const dot = (p: Pt, q: Pt) => p[0] * q[0] + p[1] * q[1];
/* the right hand of a heading, on a plan whose y runs toward the viewer */
const right = (u: Pt): Pt => [-u[1], u[0]];

type Role = "drive" | "ring" | "avenue";
function rolesOf(legs: Leg[]): Role[] {
  return legs.map((l, i) => {
    if (l.arc) return "ring";
    if (i > 0 && i < legs.length - 1) return "avenue";
    const n = legs[i ? i - 1 : 1];
    return n && !n.arc && dot(headingOn(l, 0), headingOn(n, 0)) > 0.995 ? "avenue" : "drive";
  });
}

/* the lanes right of the street's middle, as a share of a lot */
const LANE = { drive: 0.06, ring: 0.125 };
const AVENUE = [0.08, 0.235, 0.39];

/* the boulevard lane a route's turn wants: the outer when it turns right onto or off it, the inner when it turns left */
function wantOf(legs: Leg[], roles: Role[]): number {
  const bend = (j: number) => {
    const u = headingOn(legs[j], legs[j].len);
    const v = headingOn(legs[j + 1], 0);
    return u[0] * v[1] - u[1] * v[0];
  };
  const into = roles.findIndex((r, i) => r === "avenue" && roles[i - 1] === "ring");
  const onto = roles.findIndex((r, i) => r === "avenue" && roles[i + 1] === "ring");
  return (into > 0 ? bend(into - 1) : onto >= 0 ? bend(onto) : 0) > 0 ? AVENUE.length - 1 : 0;
}

/* a lane's points, each leg off its street's middle by its offset and each corner rounded */
function lanePoints(legs: Leg[], offs: number[], bend: number): Pt[] {
  if (!legs.length) return [];
  const at = (i: number, s: number) => add(pointOn(legs[i], s), right(headingOn(legs[i], s)), offs[i]);
  const corners = legs.slice(1).map((b, j) => {
    const a = legs[j];
    const u = headingOn(a, a.len);
    const v = headingOn(b, 0);
    const k = dot(u, v) > 0.995 ? null : meet(add(a.b, right(u), offs[j]), u, add(a.b, right(v), offs[j + 1]), v);
    return k ? { k, ein: dot(add(k, a.b, -1), u), eout: dot(add(k, a.b, -1), v) } : null;
  });
  const from = legs.map((_, i) => corners[i - 1]?.eout ?? 0);
  const to = legs.map((l, i) => l.len + (corners[i]?.ein ?? 0));
  const cut = corners.map((c, j) => (c ? Math.max(0, Math.min(bend, 0.45 * (to[j] - from[j]), 0.45 * (to[j + 1] - from[j + 1]))) : 0));
  const out: Pt[] = [at(0, 0)];
  let pen = 0;
  legs.forEach((l, i) => {
    const s = i < legs.length - 1 ? to[i] - cut[i] : l.len;
    if (l.arc) {
      const n = Math.max(1, Math.ceil(Math.abs(s - pen) / 2));
      for (let q = 1; q <= n; q++) out.push(at(i, pen + ((s - pen) * q) / n));
    } else out.push(at(i, s));
    if (i === legs.length - 1) return;
    const s1 = from[i + 1] + cut[i];
    const b = at(i + 1, s1);
    const c = corners[i];
    if (c && cut[i]) {
      const p0 = at(i, s);
      const k = meet(p0, headingOn(l, s), b, headingOn(legs[i + 1], s1)) ?? c.k;
      for (let q = 1; q <= 8; q++) {
        const t = q / 8;
        out.push([(1 - t) * (1 - t) * p0[0] + 2 * (1 - t) * t * k[0] + t * t * b[0], (1 - t) * (1 - t) * p0[1] + 2 * (1 - t) * t * k[1] + t * t * b[1]]);
      }
    } else out.push(b);
    pen = s1;
  });
  return out;
}

/* the traffic's frame to the plan */
const toPlan = (p: Pt): Pt => [p[0] - CX, p[1] - CY / TILT];

/** a lane in the plan, sampled every unit of its length: x, z and heading */
export interface Lane {
  x: Float32Array;
  z: Float32Array;
  /** the heading at each sample, as an angle in the plan */
  yaw: Float32Array;
  length: number;
}

function sampled(points: Pt[]): Lane {
  const p = points.map(toPlan);
  const cum = [0];
  for (let i = 1; i < p.length; i++) cum.push(cum[i - 1] + Math.hypot(p[i][0] - p[i - 1][0], p[i][1] - p[i - 1][1]));
  const length = cum[cum.length - 1] || 1;
  const n = Math.max(2, Math.ceil(length) + 1);
  const x = new Float32Array(n);
  const z = new Float32Array(n);
  const yaw = new Float32Array(n);
  let j = 0;
  for (let k = 0; k < n; k++) {
    const s = (k / (n - 1)) * length;
    while (j < p.length - 2 && cum[j + 1] < s) j++;
    const seg = cum[j + 1] - cum[j] || 1;
    const t = Math.min(1, Math.max(0, (s - cum[j]) / seg));
    x[k] = p[j][0] + (p[j + 1][0] - p[j][0]) * t;
    z[k] = p[j][1] + (p[j + 1][1] - p[j][1]) * t;
  }
  // headings over a few units, so a vehicle turns through a corner rather than snapping
  for (let k = 0; k < n; k++) {
    const a = Math.max(0, k - 2);
    const b = Math.min(n - 1, k + 2);
    yaw[k] = Math.atan2(z[b] - z[a], x[b] - x[a]);
  }
  return { x, z, yaw, length };
}

/** a route's streets: its lane, the street's middle it paves, its boulevards, and its paint */
export interface RouteStreets {
  lane: Lane;
  /** the street's middle in the plan, for its paving */
  street: Pt[];
  /** the boulevard stretches, paved wider, in the plan */
  avenues: [Pt, Pt][];
  /** ring stretches: radius and angles about downtown; boulevard stretches: bearing and radii */
  rings: { r: number; a0: number; a1: number }[];
  ways: { bearing: number; r0: number; r1: number }[];
}

/* a lane path in the traffic's frame, walked a unit at a time */
function walked(d: string): Pt[] {
  const el = document.createElementNS("http://www.w3.org/2000/svg", "path");
  el.setAttribute("d", d);
  const len = el.getTotalLength();
  const n = Math.max(2, Math.ceil(len));
  return Array.from({ length: n + 1 }, (_, i) => {
    const p = el.getPointAtLength((len * i) / n);
    return [p.x, p.y] as Pt;
  });
}

/** each route's streets, and the lane it drives: the map's fleet's own (city-traffic.tsx), or one worked out here when the page has no paths to walk */
export function streetsOf(routes: Route[], lot: number): RouteStreets[] {
  const lanes = typeof document === "undefined" ? null : trafficLanes(routes, lot);
  return routes.map((r, i) => {
    const legs = legsOf(r.d);
    const roles = rolesOf(legs);
    const k = wantOf(legs, roles);
    const offs = roles.map((role) => (role === "avenue" ? AVENUE[k] : LANE[role]) * lot);
    const lane = sampled(lanes?.[i] ? walked(lanes[i]) : lanePoints(legs, offs, 0.3 * lot));
    const street = lanePoints(legs, legs.map(() => 0), 0.3 * lot).map(toPlan);
    const c = legs.find((l) => l.arc)?.arc?.c ?? null;
    const avenues: [Pt, Pt][] = [];
    const rings: RouteStreets["rings"] = [];
    const ways: RouteStreets["ways"] = [];
    legs.forEach((l, i) => {
      if (roles[i] === "avenue" && !l.arc) {
        const back = roles[i - 1] === "ring" ? 0.25 * lot : 0;
        const on = roles[i + 1] === "ring" ? 0.25 * lot : 0;
        avenues.push([toPlan(pointOn(l, -back)), toPlan(pointOn(l, l.len + on))]);
      }
      if (!c || i === 0 || i === legs.length - 1) return;
      // the paint stops short of the street it crosses
      const cross = (j: number) => (roles[j] === "drive" || roles[j] === roles[i] ? 0 : (l.arc ? 0.475 : 0.25) * lot + 2);
      const s0 = cross(i - 1);
      const s1 = l.len - cross(i + 1);
      if (s1 - s0 < 0.13 * lot) return;
      if (l.arc) {
        const a = l.arc.t0 + (Math.sign(l.arc.dt) * s0) / l.arc.r;
        const b = l.arc.t0 + (Math.sign(l.arc.dt) * s1) / l.arc.r;
        rings.push({ r: l.arc.r, a0: Math.min(a, b), a1: Math.max(a, b) });
      } else {
        const u = headingOn(l, 0);
        const ra = Math.abs(dot(add(pointOn(l, s0), c, -1), u));
        const rb = Math.abs(dot(add(pointOn(l, s1), c, -1), u));
        ways.push({ bearing: Math.atan2(l.a[1] - c[1], l.a[0] - c[0]), r0: Math.min(ra, rb), r1: Math.max(ra, rb) });
      }
    });
    return { lane, street, avenues, rings, ways };
  });
}

export { countOf } from "@/components/explorer-v2/network/city-traffic";
/** the route's time round its lane at the city's one speed, as the map's */
export const durOf = (r: Route) => Math.min(16, Math.max(3, r.length / 48));
