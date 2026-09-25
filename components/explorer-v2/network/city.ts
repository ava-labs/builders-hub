/* The Network Map as a garden city, in plan. Downtown is the C-Chain on a
   round plaza at the centre of the plate. Every other chain lives in the
   ward of what it is for (districts.ts): a slice of the city round
   downtown, cut from the next by a boulevard. Finance faces the viewer;
   a boulevard runs straight back from downtown, so no ward stands behind
   its tower. Each ward builds out from downtown in rings of blocks: two
   rows of lots back to back, a ring road between one ring and the next.
   Inside a ward the tallest sets stand at the back and the lowest at the
   front, as for a group photo, so every roof shows; the week's new L1s
   take the front lots. When the plate is full the lots shrink, so the
   city always fits. The streets carry the traffic: a route leaves its lot
   for the ring road beside it, runs round to the nearer boulevard, and
   along it in to downtown or out to the other lot's ring road (see
   streetRoute). Pure geometry: the map draws what this returns. */

import { DISTRICTS, FRONT, districtLabel, type District } from "./districts";

export interface CityChain {
  id: string;
  district: District;
  /** messages in and out in the window */
  talks: number;
  validators: number;
  /** joined the P-Chain this week, unix seconds */
  newAt: number | null;
}

/** a place a route starts or ends, in plan: a lot, or downtown when it has no span */
export interface Stop {
  r: number;
  a: number;
  /** the ring road the lot fronts */
  road: number;
  /** its ward's arc, whose edges are boulevards */
  span: [number, number] | null;
}

export interface CityLot extends Stop {
  /** the lot's ground point on screen */
  x: number;
  y: number;
  district: District;
  /** 0 is the ward's back lot */
  rank: number;
  /** distance from downtown, 0 to 1 of the city's edge */
  reach: number;
}

/** an annular sector in plan: angles in radians, clockwise on screen from the right; radii in plan px */
export interface Arc {
  a0: number;
  a1: number;
  r0: number;
  r1: number;
}

export interface Ward extends Arc {
  district: District;
  label: string;
  /** the ward's sets, largest first */
  ids: string[];
}

export interface Block extends Arc {
  district: District;
}

export interface City {
  lots: Map<string, CityLot>;
  /** each ward's slice, from downtown's ring road to its last block */
  wards: Ward[];
  blocks: Block[];
  /** a lot's pitch in plan */
  lot: number;
  /** downtown's plaza radius in plan */
  core: number;
  /** the built city's outer radius in plan */
  edge: number;
  /** the ring roads' centre radii, downtown's first */
  rings: number[];
  /** the boulevards' width in plan */
  avenue: number;
}

export interface CityGeometry {
  cx: number;
  cy: number;
  /** how far the plate leans back: the projected depth of a unit of ground */
  tilt: number;
  /** the plan radius the city may build out to */
  reach: number;
  /** downtown's tower */
  hub: { w: number; h: number };
}

const LOT_MAX = 52;
const LOT_MIN = 12;
/** lots in a row of a block */
const BLOCK = 3;
/** in lots: the lane between two blocks, a ring road, a boulevard */
const LANE = 0.3;
const ROAD = 0.5;
const AVENUE = 0.95;

/* a ward's claim on the circle: a small ward keeps room for a block */
const weightOf = (n: number) => Math.pow(n, 0.8) + 0.8;

/* each ward's arc, clockwise from the boulevard behind downtown. The
   front ward faces the viewer: the wards before it in the city's order
   share the right half, the ones after it the left, and it stands between
   the two runs that weigh most alike. */
function arcsOf(counts: { key: District; n: number }[]): { key: District; a0: number; a1: number }[] {
  const front = counts.find((c) => c.key === FRONT);
  const rest = counts.filter((c) => c.key !== FRONT);
  const w = (c: { n: number }) => weightOf(c.n);
  const total = counts.reduce((a, c) => a + w(c), 0);
  if (!front || rest.length < 2) {
    let at = -Math.PI / 2;
    return counts.map((c) => {
      const s = (2 * Math.PI * w(c)) / total;
      at += s;
      return { key: c.key, a0: at - s, a1: at };
    });
  }
  // where the front ward stands in the run: the split that best balances the two halves
  let split = 1;
  let best = Infinity;
  for (let j = 1; j < rest.length; j++) {
    const right = rest.slice(0, j).reduce((a, c) => a + w(c), 0);
    const left = rest.slice(j).reduce((a, c) => a + w(c), 0);
    if (Math.abs(right - left) < best) {
      best = Math.abs(right - left);
      split = j;
    }
  }
  const f = (2 * Math.PI * w(front)) / total;
  const out: { key: District; a0: number; a1: number }[] = [];
  const lay = (run: typeof rest, from: number, to: number) => {
    const sum = run.reduce((a, c) => a + w(c), 0);
    let at = from;
    for (const c of run) {
      const s = ((to - from) * w(c)) / sum;
      out.push({ key: c.key, a0: at, a1: at + s });
      at += s;
    }
  };
  lay(rest.slice(0, split), -Math.PI / 2, Math.PI / 2 - f / 2);
  out.push({ key: front.key, a0: Math.PI / 2 - f / 2, a1: Math.PI / 2 + f / 2 });
  lay(rest.slice(split), Math.PI / 2 + f / 2, (3 * Math.PI) / 2);
  return out;
}

interface Plot {
  blocks: Arc[];
  lots: { r: number; a: number; road: number }[];
}

/* the lots one row of a ring gives a ward: as many as its arc holds, in
   blocks of up to BLOCK with a lane between, the blocks as even as can be */
function rowOf(arc: number, lot: number): number[] {
  let c = 0;
  while ((c + 1) * lot + (Math.ceil((c + 1) / BLOCK) - 1) * LANE * lot <= arc) c++;
  if (!c) return [];
  const nb = Math.ceil(c / BLOCK);
  const base = Math.floor(c / nb);
  const extra = c - base * nb;
  // the longer blocks at the middle, so a ward is symmetric about its axis
  const sizes = Array.from({ length: nb }, () => base);
  const middle = [...sizes.keys()].sort((i, j) => Math.abs(i - (nb - 1) / 2) - Math.abs(j - (nb - 1) / 2) || i - j);
  for (let k = 0; k < extra; k++) sizes[middle[k]]++;
  return sizes;
}

/* a ward's blocks and lots at a lot pitch, ring by ring from downtown out,
   or null when it will not fit inside the reach */
function plotWard(n: number, a0: number, a1: number, lot: number, core: number, reach: number): Plot | null {
  const blocks: Arc[] = [];
  const lots: { r: number; a: number; road: number }[] = [];
  const mid = (a0 + a1) / 2;
  for (let p = 0; lots.length < n; p++) {
    const r0 = core + ROAD * lot + p * (2 + ROAD) * lot;
    const r1 = r0 + 2 * lot;
    if (r1 > reach) return null;
    const m = r0 + lot;
    // the arc this ring gives the ward, less half a boulevard at each side
    const sizes = rowOf((a1 - a0) * m - AVENUE * lot, lot);
    if (!sizes.length) continue;
    const c = sizes.reduce((a, b) => a + b, 0);
    const used = (c + (sizes.length - 1) * LANE) * lot;
    let at = mid - used / 2 / m;
    const ring: { r: number; a: number; road: number; row: number; block: number }[] = [];
    const arcs: Arc[] = [];
    sizes.forEach((size, b) => {
      arcs.push({ a0: at, a1: at + (size * lot) / m, r0, r1 });
      // the inner row fronts the ring road inside the ring, the outer row the one outside it
      for (let row = 0; row < 2; row++)
        for (let l = 0; l < size; l++) ring.push({ r: r0 + lot * (row + 0.5), a: at + ((l + 0.5) * lot) / m, road: row ? r1 + (ROAD * lot) / 2 : r0 - (ROAD * lot) / 2, row, block: b });
      at += ((size + LANE) * lot) / m;
    });
    // the ring's inner row first, from the ward's middle out, so a part-built ring stays compact
    ring.sort((x, y) => x.row - y.row || Math.abs(x.a - mid) - Math.abs(y.a - mid));
    const taken = ring.slice(0, n - lots.length);
    lots.push(...taken);
    // a block stands only where a set does
    const built = new Set(taken.map((t) => t.block));
    arcs.forEach((arc, b) => built.has(b) && blocks.push(arc));
  }
  return { blocks, lots };
}

export function planCity(chains: CityChain[], g: CityGeometry): City {
  // each ward's sets, largest first, the week's new L1s last
  const groups = new Map<District, CityChain[]>();
  for (const c of chains) {
    const list = groups.get(c.district);
    if (list) list.push(c);
    else groups.set(c.district, [c]);
  }
  for (const list of groups.values())
    list.sort(
      (a, b) =>
        Number(a.newAt !== null) - Number(b.newAt !== null) ||
        (a.newAt ?? 0) - (b.newAt ?? 0) ||
        b.validators - a.validators ||
        b.talks - a.talks ||
        a.id.localeCompare(b.id),
    );
  const order = DISTRICTS.map((d) => d.key).filter((k) => (groups.get(k)?.length ?? 0) > 0);
  // downtown's plaza: room round the tower's podium for its name on the ground in front
  const coreOf = (lot: number) => Math.max(g.hub.w * 5, lot * 2.1);
  if (!order.length) return { lots: new Map(), wards: [], blocks: [], lot: LOT_MAX, core: coreOf(LOT_MAX), edge: coreOf(LOT_MAX), rings: [], avenue: AVENUE * LOT_MAX };

  const arcs = arcsOf(order.map((k) => ({ key: k, n: groups.get(k)!.length })));
  order.splice(0, order.length, ...arcs.map((a) => a.key));
  // the largest lots with which every ward fits inside the reach
  let lot = LOT_MAX;
  let plots: (Plot | null)[] = [];
  for (; lot >= LOT_MIN; lot -= 1) {
    const core = coreOf(lot);
    plots = order.map((k, i) => plotWard(groups.get(k)!.length, arcs[i].a0, arcs[i].a1, lot, core, g.reach));
    if (plots.every(Boolean)) break;
  }
  if (lot < LOT_MIN) {
    lot = LOT_MIN;
    const core = coreOf(lot);
    plots = order.map((k, i) => plotWard(groups.get(k)!.length, arcs[i].a0, arcs[i].a1, lot, core, Infinity));
  }
  const core = coreOf(lot);
  const screen = (r: number, a: number): [number, number] => [g.cx + r * Math.cos(a), g.cy + r * Math.sin(a) * g.tilt];

  const lots = new Map<string, CityLot>();
  const wards: Ward[] = [];
  const blocks: Block[] = [];
  let edge = core;
  order.forEach((k, i) => {
    const plot = plots[i]!;
    const members = groups.get(k)!;
    for (const b of plot.blocks) blocks.push({ ...b, district: k });
    const r1 = Math.max(...plot.blocks.map((b) => b.r1));
    edge = Math.max(edge, r1);
    // the group photo: the tallest sets on the lots farthest back, the lowest and the newest in front
    const spots = plot.lots.map((l) => ({ ...l, y: screen(l.r, l.a)[1] })).sort((a, b) => a.y - b.y || a.a - b.a);
    members.forEach((c, rank) => {
      const s = spots[rank];
      if (!s) return;
      const [x, y] = screen(s.r, s.a);
      lots.set(c.id, { x, y, district: k, rank, reach: 0, r: s.r, a: s.a, road: s.road, span: [arcs[i].a0, arcs[i].a1] });
    });
    wards.push({ district: k, label: districtLabel(k), ids: members.map((c) => c.id), a0: arcs[i].a0, a1: arcs[i].a1, r0: core, r1 });
  });
  for (const l of lots.values()) l.reach = Math.min(1, l.r / edge);
  const pairs = Math.round((edge - core - ROAD * lot) / ((2 + ROAD) * lot)) + 1;
  const rings = Array.from({ length: Math.max(1, pairs) }, (_, p) => core + (ROAD * lot) / 2 + p * (2 + ROAD) * lot);
  return { lots, wards, blocks, lot, core, edge, rings, avenue: AVENUE * lot };
}

/** a street route in plan: [radius, angle] points, each leg along a ring road (an arc) or straight out a boulevard */
export interface Street {
  pts: [number, number][];
  /** leg k, from point k to k + 1, runs round a ring road */
  arcs: boolean[];
}

/** an angle's turn into (-π, π] */
export const turn = (d: number) => d - 2 * Math.PI * Math.ceil((d - Math.PI) / (2 * Math.PI));

/* how traffic drives from one place to another: out of its lot to the
   ring road it fronts, round to the boulevard at its ward's edge on the
   other place's side, along the boulevard to the other place's ring road
   (or in to downtown's plaza and the tower's foot), and round that road
   to its lot. A route inside one ring of one ward keeps to its road. */
export function streetRoute(from: Stop, to: Stop, core: number, foot: number): Street {
  if (!from.span && !to.span) return { pts: [], arcs: [] };
  if (!from.span) {
    const back = streetRoute(to, from, core, foot);
    return { pts: [...back.pts].reverse(), arcs: [...back.arcs].reverse() };
  }
  const [a0, a1] = from.span;
  const pts: [number, number][] = [[from.r, from.a], [from.road, from.a]];
  const arcs: boolean[] = [false];
  const nearer = Math.abs(turn(from.a - a0)) <= Math.abs(turn(a1 - from.a)) ? a0 : a1;
  if (!to.span) {
    pts.push([from.road, nearer], [core, nearer], [foot, nearer]);
    arcs.push(true, false, false);
    return { pts, arcs };
  }
  const same = to.span[0] === a0 && to.span[1] === a1;
  if (same && Math.abs(to.road - from.road) < 0.5) {
    pts.push([to.road, to.a]);
    arcs.push(true);
  } else {
    const b = same ? nearer : turn(to.a - from.a) > 0 ? a1 : a0;
    pts.push([from.road, b], [to.road, b], [to.road, to.a]);
    arcs.push(true, false, true);
  }
  pts.push([to.r, to.a]);
  arcs.push(false);
  return { pts, arcs };
}
