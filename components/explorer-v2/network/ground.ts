import type { City } from "@/components/explorer-v2/network/city";
import { arcPath, diceOf, TILT } from "@/components/explorer-v2/network/city-geometry";

/* The city's ground as a model maker lays it: every block cut into its
   plots, the plots no L1 stands on laid to lawn with a tree or two, trees
   down both sides of the boulevards, and a river that comes in from under
   the ledger, bends round the city through the outskirts and leaves under
   the ledger again, bridged where the boulevards run out to it. It keeps
   clear of the Frontier's outskirts, where the building sites stand.
   Pure: the map draws the paths. Everything is in plan (the ground's own
   frame, a circle round downtown) except the trees, which stand up and are
   placed on screen. */

const DEG = Math.PI / 180;
/** the river's run round the city */
const RIVER_SPAN = 150 * DEG;
/** where it starts when there is no Frontier to keep clear of */
const RIVER_START = 212 * DEG;

export interface River {
  /** the lawns along both banks, under the water */
  banks: string;
  /** the water */
  water: string;
  /** a pale line down its middle, the current */
  current: string;
  /** the bridges where the boulevards cross it */
  bridges: string;
}

export interface Ground {
  /** the boulevards' run from the city's edge out to the ledger, in the streets' shade */
  roads: string;
  /** the lot lines inside the blocks */
  plots: string;
  /** the plots no L1 stands on, laid to lawn */
  gardens: string;
  /** trees on screen: x, y and the crown's radius */
  trees: [number, number, number][];
  river: River | null;
  /** whether a plan point (radius, angle) is in the river or on its banks */
  wet: (r: number, a: number) => boolean;
}

const P = (r: number, a: number) => `${(r * Math.cos(a)).toFixed(1)},${(r * Math.sin(a)).toFixed(1)}`;
/** an angle's distance clockwise from `from`, in [0, 2π) */
const past = (a: number, from: number) => (((a - from) % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
const smooth = (t: number) => t * t * (3 - 2 * t);

export function groundOf(city: City, g: { cx: number; cy: number; ringIn: number }): Ground {
  const lot = city.lot;
  const screen = (r: number, a: number): [number, number] => [g.cx + r * Math.cos(a), g.cy + r * Math.sin(a) * TILT];
  const lines: string[] = [];
  const lawns: string[] = [];
  const trees: [number, number, number][] = [];
  const standing = [...city.lots.values()];

  /* the plots: a block holds two rows of lots, `size` across */
  city.blocks.forEach((b, i) => {
    const m = b.r0 + lot;
    const size = Math.max(1, Math.round(((b.a1 - b.a0) * m) / lot));
    const step = (b.a1 - b.a0) / size;
    const inset = 1.2;
    for (let k = 1; k < size; k++) {
      const a = b.a0 + k * step;
      lines.push(`M${P(b.r0 + inset, a)}L${P(b.r1 - inset, a)}`);
    }
    const ia = inset / m;
    lines.push(`M${P(m, b.a0 + ia)}A${m.toFixed(1)},${m.toFixed(1)} 0 0 1 ${P(m, b.a1 - ia)}`);
    // the plots a set stands on
    const taken = new Set<string>();
    for (const l of standing) {
      if (l.r < b.r0 || l.r > b.r1 || l.a < b.a0 || l.a > b.a1) continue;
      taken.add(`${l.r < m ? 0 : 1}:${Math.min(size - 1, Math.floor((l.a - b.a0) / step))}`);
    }
    const roll = diceOf(`plot:${i}`);
    for (let row = 0; row < 2; row++) {
      for (let k = 0; k < size; k++) {
        if (taken.has(`${row}:${k}`)) continue;
        const pad = 1.8;
        const r0 = b.r0 + row * lot + pad;
        const r1 = b.r0 + (row + 1) * lot - pad;
        const a0 = b.a0 + k * step + pad / m;
        const a1 = b.a0 + (k + 1) * step - pad / m;
        lawns.push(arcPath(a0, a1, r0, r1));
        for (let t = 0, n = 1 + Math.floor(roll() * 2); t < n; t++) {
          const [x, y] = screen(r0 + (r1 - r0) * (0.25 + roll() * 0.5), a0 + (a1 - a0) * (0.2 + roll() * 0.6));
          trees.push([x, y, 1.6 + roll() * 0.9]);
        }
      }
    }
  });

  /* the boulevards: each runs down the seam between two wards, out from
     downtown's ring road; trees stand along both sides, off the ring roads */
  const roadHalf = lot * 0.25 + 2.5;
  const onRing = (r: number) => city.rings.some((c) => Math.abs(r - c) < roadHalf);
  if (city.wards.length > 1) {
    for (const w of city.wards) {
      const seam = w.a0;
      const next = city.wards.find((o) => {
        const d = past(o.a1, seam);
        return d < 1e-6 || d > 2 * Math.PI - 1e-6;
      });
      const out = Math.max(w.r1, next?.r1 ?? w.r1);
      const roll = diceOf(`avenue:${w.district}`);
      for (let r = city.core + lot * 0.9; r < out; r += lot * 1.3) {
        if (onRing(r)) continue;
        for (const side of [-1, 1]) {
          const a = seam + (side * (city.avenue / 2 - 1.8)) / r;
          // a tree stands on a block's side, not out on open ground
          if (!city.blocks.some((b) => r > b.r0 && r < b.r1 && Math.min(Math.abs(past(a, b.a0)), Math.abs(past(b.a1, a))) * r < city.avenue * 0.6)) continue;
          const [x, y] = screen(r + (roll() - 0.5) * 2, a);
          trees.push([x, y, 1.5 + roll() * 0.6]);
        }
      }
    }
  }

  /* the river, round the city's front through the outskirts, clockwise
     against the wards' order from just short of the Frontier */
  const frontier = city.wards.find((w) => w.district === "frontier");
  const start = (frontier ? frontier.a0 : RIVER_START) - 5 * DEG;
  const room = g.ringIn - city.edge;
  let river: River | null = null;
  let centre: (t: number) => number = () => -1;
  let width: (t: number) => number = () => 0;
  if (city.wards.length && room > 40) {
    // the city's edge at an angle: the last block of the ward it falls in
    const edgeAt = (a: number) => {
      const w = city.wards.find((o) => past(a, o.a0) <= past(o.a1, o.a0));
      return w ? w.r1 : city.edge;
    };
    const N = 150;
    const raw = Array.from({ length: N + 1 }, (_, i) => {
      const a = start - (RIVER_SPAN * i) / N;
      // clear of the city's last blocks by a street's width, however big its lots are
      const lo = edgeAt(a) + 12;
      const hi = g.ringIn - 14;
      return lo + (hi - lo) * 0.5;
    });
    // eased across the wards' edges, so the banks do not step
    const soft = raw.map((_, i) => {
      let sum = 0;
      let n = 0;
      for (let k = -16; k <= 16; k++) {
        const v = raw[i + k];
        if (v !== undefined) {
          sum += v;
          n++;
        }
      }
      return sum / n;
    });
    const at = (t: number) => soft[Math.max(0, Math.min(N, Math.round(t * N)))];
    width = (t: number) => Math.min(room * 0.26, 15 + 2.5 * Math.sin(t * 17 + 1));
    centre = (t: number) => {
      const bend = at(t) + 6 * Math.sin(t * 12.5 + 0.7);
      // in and out from under the ledger
      const edge = t < 0.12 ? 1 - smooth(t / 0.12) : t > 0.88 ? smooth((t - 0.88) / 0.12) : 0;
      return bend + (g.ringIn + 8 - bend) * edge;
    };
    const band = (grow: number) => {
      const inner: string[] = [];
      const outer: string[] = [];
      for (let i = 0; i <= N; i++) {
        const t = i / N;
        const a = start - RIVER_SPAN * t;
        const c = centre(t);
        const h = width(t) / 2 + grow;
        inner.push(P(c - h, a));
        outer.push(P(c + h, a));
      }
      return `M${inner.join("L")}L${outer.reverse().join("L")}Z`;
    };
    const mid: string[] = [];
    const roll = diceOf("river");
    for (let i = 0; i <= N; i++) {
      const t = i / N;
      const a = start - RIVER_SPAN * t;
      const c = centre(t);
      if (t > 0.1 && t < 0.9) mid.push(P(c, a));
      // trees along the banks' lawns, now one side, now the other
      if (i % 4 === 2 && t > 0.14 && t < 0.86) {
        const side = roll() < 0.5 ? -1 : 1;
        const [x, y] = screen(c + side * (width(t) / 2 + 3.2 + roll() * 1.5), a);
        trees.push([x, y, 1.7 + roll() * 0.8]);
      }
    }
    const banks = band(6.5);
    const water = band(0);
    const current = mid.length ? `M${mid.join("L")}` : "";
    // a bridge where each boulevard crosses, clear of the river's mouths
    const bridges: string[] = [];
    for (const w of city.wards) {
      const t = past(start, w.a0) / RIVER_SPAN;
      if (t < 0.16 || t > 0.84) continue;
      const c = centre(t);
      // the deck spans the water and both banks' lawns
      const h = width(t) / 2 + 7;
      const half = (city.avenue * 0.32) / c;
      bridges.push(arcPath(w.a0 - half, w.a0 + half, c - h, c + h));
    }
    river = { banks, water, current, bridges: bridges.join("") };
  }
  const wet = (r: number, a: number) => {
    if (!river) return false;
    const t = past(start, a) / RIVER_SPAN;
    if (t > 1.03) return false;
    return Math.abs(r - centre(Math.min(1, t))) < width(Math.min(1, t)) / 2 + 5;
  };

  const roads: string[] = [];
  if (city.wards.length > 1) {
    for (const w of city.wards) {
      const from = Math.max(w.r1, city.wards.find((o) => { const d = past(o.a1, w.a0); return d < 1e-6 || d > 2 * Math.PI - 1e-6; })?.r1 ?? w.r1) + lot * 0.2;
      const half = (city.avenue * 0.32) / from;
      if (from < g.ringIn) roads.push(arcPath(w.a0 - half, w.a0 + half, from, g.ringIn + 4));
    }
  }

  return { roads: roads.join(""), plots: lines.join(""), gardens: lawns.join(""), trees, river, wet };
}
