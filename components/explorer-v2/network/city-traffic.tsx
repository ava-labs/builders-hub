import { TILT } from "@/components/explorer-v2/network/city-geometry";
import type { Route } from "@/components/explorer-v2/network/icm-map";

export interface TrafficRoute {
  route: Route;
  /** the id of the route's path in the map; the traffic's own lane takes its name from it */
  pathId: string;
  /** one of its ends is in what the search, a cut or the camera's district shows */
  on: boolean;
  /** hovered, or one of its ends is the lit chain */
  hot: boolean;
  /** one of its ends is the picked chain */
  blue: boolean;
  /** the sender's color, when it has one */
  ink: string | null;
  /** its place in the map's list: the roads light out one after another */
  index: number;
}

/** a lot's pitch in plan, which the streets and the vehicles are sized against */
const LOT = 46;

type Pt = [number, number];
interface Leg {
  a: Pt;
  b: Pt;
  len: number;
  /** a leg round a ring road: its centre, radius, start angle and turn */
  arc: { c: Pt; r: number; t0: number; dt: number } | null;
}

/* the route's legs in plan: its screen path with the tilt taken out, so a
   ring road's ellipse is a circle again */
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
      // sweep 1 runs clockwise on screen, round a centre on its right
      const side = n[4] ? 1 : -1;
      const h = Math.sqrt(r * r - (chord / 2) ** 2) * side;
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

/* the point s along a leg, and the way it heads there */
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

/* where two headings' lines cross: a corner's control point */
function meet(a: Pt, u: Pt, b: Pt, v: Pt): Pt | null {
  const den = u[0] * v[1] - u[1] * v[0];
  if (Math.abs(den) < 1e-3) return null;
  const s = ((b[0] - a[0]) * v[1] - (b[1] - a[1]) * v[0]) / den;
  return [a[0] + u[0] * s, a[1] + u[1] * s];
}

const pt = (p: Pt) => `${p[0].toFixed(2)},${p[1].toFixed(2)}`;
/** an angle's turn into (-π, π] */
const turn = (a: number) => a - 2 * Math.PI * Math.round(a / (2 * Math.PI));
const add = (p: Pt, q: Pt, k = 1): Pt => [p[0] + q[0] * k, p[1] + q[1] * k];
const dot = (p: Pt, q: Pt) => p[0] * q[0] + p[1] * q[1];
/* the right hand of a heading, on a plan whose y runs down */
const right = (u: Pt): Pt => [-u[1], u[0]];

/* what each leg of a route is: a lot's driveway, a ring road, or a
   boulevard, downtown's forecourt counted with the boulevard it runs on */
type Role = "drive" | "ring" | "avenue";
function rolesOf(legs: Leg[]): Role[] {
  return legs.map((l, i) => {
    if (l.arc) return "ring";
    if (i > 0 && i < legs.length - 1) return "avenue";
    const n = legs[i ? i - 1 : 1];
    return n && !n.arc && dot(headingOn(l, 0), headingOn(n, 0)) > 0.995 ? "avenue" : "drive";
  });
}

/* the lanes, as a share of a lot, right of the street's middle: one each
   way on a driveway and a ring road, three each way on a boulevard, the
   inner first */
const LANE = { drive: 0.06, ring: 0.125 };
const AVENUE = [0.08, 0.235, 0.39];
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

/* how far right of each leg's middle the route drives, in boulevard lane k */
const offsetsOf = (roles: Role[], k: number, lot: number) => roles.map((r) => (r === "avenue" ? AVENUE[k] : LANE[r]) * lot);

/* a leg from where the pen stands to s along it, off its middle by o */
function legTo(l: Leg, s: number, o = 0): string {
  const e = add(pointOn(l, s), right(headingOn(l, s)), o);
  if (!l.arc) return ` L${pt(e)}`;
  // right of a clockwise arc is its inside
  const r = (l.arc.r - Math.sign(l.arc.dt) * o).toFixed(2);
  return ` A${r},${r} 0 0 ${l.arc.dt > 0 ? 1 : 0} ${pt(e)}`;
}

/* the route as driven, in plan: each leg off its middle by its lane, and
   each corner rounded off from where the two lanes meet, so a vehicle turns
   through it, and changes lane in it, instead of snapping round. With the
   path come its points, close enough to follow the way it heads */
function laneOf(legs: Leg[], offs: number[], bend: number): { d: string; pts: Pt[] } {
  if (!legs.length) return { d: "", pts: [] };
  const at = (i: number, s: number) => add(pointOn(legs[i], s), right(headingOn(legs[i], s)), offs[i]);
  // where each corner's two lanes cross, and how far along either leg that is
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
  let d = `M${pt(at(0, 0))}`;
  const pts: Pt[] = [at(0, 0)];
  legs.forEach((l, i) => {
    const s0 = i ? from[i] + cut[i - 1] : 0;
    const s = i < legs.length - 1 ? to[i] - cut[i] : l.len;
    d += legTo(l, s, offs[i]);
    // an arc every few degrees
    const n = l.arc ? Math.max(1, Math.ceil(Math.abs(s - s0) / l.arc.r / 0.05)) : 1;
    for (let j = 1; j <= n; j++) pts.push(at(i, s0 + ((s - s0) * j) / n));
    if (i === legs.length - 1) return;
    const s1 = from[i + 1] + cut[i];
    const b = at(i + 1, s1);
    const c = corners[i];
    if (!c || !cut[i]) {
      d += ` L${pt(b)}`;
      pts.push(b);
      return;
    }
    const a = at(i, s);
    const q = meet(a, headingOn(l, s), b, headingOn(legs[i + 1], s1)) ?? c.k;
    d += ` Q${pt(q)} ${pt(b)}`;
    for (let j = 1; j <= 12; j++) {
      const t = j / 12;
      pts.push([(1 - t) ** 2 * a[0] + 2 * t * (1 - t) * q[0] + t * t * b[0], (1 - t) ** 2 * a[1] + 2 * t * (1 - t) * q[1] + t * t * b[1]]);
    }
  });
  return { d, pts };
}

/** the headings the fleet is drawn in, round the turn */
const HEADINGS = 48;

/* where along a lane a vehicle turns from one of the fleet's headings to
   the next: the share of the lane driven, and the heading it takes there.
   A heading holds until the lane is past the next one's middle, so a
   straight that runs between two does not flicker */
interface Turns {
  at: number[];
  k: number[];
}
function turnsOf(pts: Pt[]): Turns {
  const step = (2 * Math.PI) / HEADINGS;
  const len = [0];
  for (let i = 1; i < pts.length; i++) len.push(len[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  const total = len[len.length - 1] || 1;
  const out: Turns = { at: [], k: [] };
  let cur = -1;
  for (let i = 1; i < pts.length; i++) {
    if (len[i] - len[i - 1] < 1e-6) continue;
    const a = Math.atan2(pts[i][1] - pts[i - 1][1], pts[i][0] - pts[i - 1][0]);
    if (cur >= 0 && Math.abs(turn(a - cur * step)) < step / 2 + 0.01) continue;
    const k = ((Math.round(a / step) % HEADINGS) + HEADINGS) % HEADINGS;
    if (k === cur) continue;
    const at = cur < 0 ? 0 : len[i - 1] / total;
    if (out.at.length && at - out.at[out.at.length - 1] < 1e-4) out.k[out.k.length - 1] = k;
    else {
      out.at.push(at);
      out.k.push(k);
    }
    cur = k;
  }
  return out;
}

/* a stretch of street: round a ring road, as a radius and a turn of angle
   about downtown, or along a boulevard, as a bearing and a run of radius */
type Piece = { ring: number; a0: number; a1: number } | { bearing: number; r0: number; r1: number };

/* the stretches of street a route drives, not its driveways. For the
   paint each stops short of the street it crosses, and leaves downtown's
   forecourt bare; for the paving each runs on across it, so a crossing is
   paved whole */
function piecesOf(legs: Leg[], roles: Role[], lot: number, paint: boolean): Piece[] {
  const c = legs.find((l) => l.arc)?.arc?.c;
  if (!c) return [];
  const out: Piece[] = [];
  legs.forEach((l, i) => {
    const role = roles[i];
    if (role === "drive" || (paint && (i === 0 || i === legs.length - 1))) return;
    // how far the stretch runs on past a leg's end, into the street it meets there
    const by = (j: number) => {
      const r = roles[j];
      if (r === undefined || r === role) return 0;
      if (paint) return r === "drive" ? 0 : -((l.arc ? 0.475 : 0.25) * lot + 2);
      return !l.arc || r === "drive" ? 0.25 * lot : 0;
    };
    const s0 = -by(i - 1);
    const s1 = l.len + by(i + 1);
    if (s1 - s0 < 0.13 * lot) return;
    if (l.arc) {
      const { r, t0, dt } = l.arc;
      const a = t0 + (Math.sign(dt) * s0) / r;
      const b = t0 + (Math.sign(dt) * s1) / r;
      out.push({ ring: r, a0: Math.min(a, b), a1: Math.max(a, b) });
    } else {
      const u = headingOn(l, 0);
      const ra = Math.abs(dot(add(pointOn(l, s0), c, -1), u));
      const rb = Math.abs(dot(add(pointOn(l, s1), c, -1), u));
      out.push({ bearing: Math.atan2(l.a[1] - c[1], l.a[0] - c[0]), r0: Math.min(ra, rb), r1: Math.max(ra, rb) });
    }
  });
  return out;
}

/* each route's streets and paint, worked out once per route the map plans */
interface Plan {
  lot: number;
  legs: Leg[];
  roles: Role[];
  /** the street's middle, which the paving follows */
  street: string;
  /** its stretches of each street, for the paving and for the paint */
  paving: Piece[];
  paint: Piece[];
  /** its boulevard's bearing from downtown, and whether it drives it out */
  way: { bearing: number; out: boolean } | null;
  /** how far it drives its boulevard */
  run: number;
  /** the boulevard lane its turn wants */
  want: number;
  /** the share of the route driven before its boulevard */
  entry: number;
  /** the lane it drives, and where it turns, by the boulevard lane it takes */
  lanes: { d: string; turns: Turns }[];
}
const plans = new WeakMap<Route, Plan>();
function planOf(r: Route, lot: number): Plan {
  const had = plans.get(r);
  if (had && had.lot === lot) return had;
  const legs = legsOf(r.d);
  const roles = rolesOf(legs);
  const c = legs.find((l) => l.arc)?.arc?.c ?? null;
  const ave = legs.find((l, i) => roles[i] === "avenue" && !l.arc) ?? null;
  const out = ave && c ? dot(headingOn(ave, 0), add(ave.a, c, -1)) > 0 : false;
  const plan: Plan = {
    lot,
    legs,
    roles,
    street: laneOf(legs, legs.map(() => 0), 0.3 * lot).d,
    paving: piecesOf(legs, roles, lot, false),
    paint: piecesOf(legs, roles, lot, true),
    way: ave && c ? { bearing: Math.atan2(ave.a[1] - c[1], ave.a[0] - c[0]), out } : null,
    run: legs.reduce((t, l, i) => t + (roles[i] === "avenue" ? l.len : 0), 0),
    want: wantOf(legs, roles),
    entry: (() => {
      const k = roles.indexOf("avenue");
      const all = legs.reduce((t, l) => t + l.len, 0) || 1;
      return k < 0 ? 0 : legs.slice(0, k).reduce((t, l) => t + l.len, 0) / all;
    })(),
    lanes: [],
  };
  plans.set(r, plan);
  return plan;
}
function driveOf(p: Plan, k: number) {
  if (!p.lanes[k]) {
    const { d, pts } = laneOf(p.legs, offsetsOf(p.roles, k, p.lot), 0.3 * p.lot);
    p.lanes[k] = { d, turns: turnsOf(pts) };
  }
  return p.lanes[k];
}
const laneFor = (p: Plan, k: number) => driveOf(p, k).d;

/** as many vehicles as the route is busy */
export const countOf = (heat: number) => 1 + Math.round(heat * 5);

/** each route's lane as the fleet drives it, in the traffic layer's frame (screen x, screen y over TILT) */
export function trafficLanes(routes: Route[], lot = LOT): string[] {
  const plan = routes.map((r) => planOf(r, lot));
  const lane = lanesOf(plan, routes.map((r) => countOf(r.heat))).lane;
  return plan.map((p, i) => laneFor(p, lane[i]));
}

/* the boulevard lanes, shared out among the routes that drive one
   boulevard one way: each takes the lane its turn wants unless sharing it
   would run more of the boulevard's vehicles through one another, since
   the whole city drives at one speed and two in one lane that meet stay
   met. The fewest meetings wins, weighed as the two routes' vehicles and
   the boulevard they share; a lane away from the turn costs a little, for
   the lanes the vehicle crosses in the corner */
function lanesOf(plans: Plan[], counts: number[]): { lane: number[]; ways: number[][] } {
  const lane = plans.map((p) => p.want);
  const ways: number[][] = [];
  plans.forEach((p, i) => {
    const w = p.way;
    if (!w) return;
    const same = ways.find((g) => {
      const v = plans[g[0]].way!;
      return v.out === w.out && Math.abs(turn(v.bearing - w.bearing)) < 0.03;
    });
    if (same) same.push(i);
    else ways.push([i]);
  });
  const n = AVENUE.length;
  for (const group of ways) {
    if (group.length < 2 || group.length > 7) continue;
    let best = Infinity;
    let pick: number[] = [];
    for (let m = 0; m < n ** group.length; m++) {
      const ks = group.map((_, a) => Math.floor(m / n ** a) % n);
      let cost = 0;
      group.forEach((i, a) => {
        cost += Math.abs(ks[a] - plans[i].want) * 0.15 * counts[i] * plans[i].lot;
        group.forEach((j, b) => b > a && ks[a] === ks[b] && (cost += counts[i] * counts[j] * Math.min(plans[i].run, plans[j].run)));
      });
      if (cost < best) {
        best = cost;
        pick = ks;
      }
    }
    group.forEach((i, a) => (lane[i] = pick[a]));
  }
  return { lane, ways };
}
type Face = "front" | "rear" | "right" | "left";
/** a mark on a face of a solid: the solid, the face, a run along the face and a band of height */
type Mark = [number, Face, [number, number], [number, number]];
const on = (i: number, face: Face, z: [number, number]) => (u: [number, number]): Mark => [i, face, u, z];
