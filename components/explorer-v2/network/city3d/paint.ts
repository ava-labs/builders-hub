import { arcPath } from "@/components/explorer-v2/network/city-geometry";
import { PLATE } from "@/components/explorer-v2/network/icm-map";
import type { City } from "@/components/explorer-v2/network/city";
import type { Ground } from "@/components/explorer-v2/network/ground";
import { GROUND, FLEET, type Theme } from "./palette";
import type { Outskirts } from "./model";
import type { RouteStreets } from "./lanes";

/* The ground's paint, as the map lays its ground layer: the plate in the
   P-Chain's earth, the built city's streets a shade under it, the
   outskirts' plots and parks, the boulevards run on to the ledger, the
   river and its banks, the streets the traffic drives paved as busy as
   they are, the blocks' tops with their plots and lawns, downtown's plaza
   in its light, and a soft shadow at every building's foot. It is painted
   once in the plan, into one canvas that the plate and every block's top
   read at their own place. */

/** the paint's size in pixels: about two to a unit of the plan */
export const PAINT_PX = 2048;

type Pt = [number, number];

export interface PaintInput {
  theme: Theme;
  city: City;
  terrain: Ground;
  outskirts: Outskirts;
  streets: RouteStreets[];
  heats: number[];
  /** each building's foot on its lot: a box's corners, or a drum's centre and radius */
  feet: { poly?: Pt[]; round?: [number, number, number] }[];
  /** each new L1's lot, fenced while it goes up */
  sites: Pt[][];
  /** the trees on the ground, whose feet darken it: their places in the plan and their crowns' radii */
  trees?: { x: number; z: number; r: number }[];
}


/* a CSS color between two, by share */
function mixHex(a: string, b: string, t: number): string {
  const p = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const [x, y] = [p(a), p(b)];
  return `rgb(${x.map((v, i) => Math.round(v + (y[i] - v) * t)).join(",")})`;
}

export function paintGround(canvas: HTMLCanvasElement, input: PaintInput) {
  const { theme, city, terrain, outskirts, streets, heats, feet, sites, trees = [] } = input;
  const c = (p: { light: string; dark: string }) => p[theme];
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const S = canvas.width;
  const k = S / (2 * PLATE);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, S, S);
  ctx.setTransform(k, 0, 0, k, S / 2, S / 2);
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  const fill = (d: string, color: string) => {
    ctx.fillStyle = color;
    ctx.fill(new Path2D(d));
  };
  // a lawn: a model's lawn, a matte cool green-gray
  const lawn = (d: string, color: string) => fill(d, color);
  const stroke = (d: string, color: string, width: number) => {
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.stroke(new Path2D(d));
  };
  /* the ground's shade where things meet it: a path's blurred shadow and not the path, cast
     back from off the canvas, so two shades that meet are no darker where they overlap */
  const shade = (path: Path2D, color: string, blur: number, kind: "fill" | "stroke" = "fill", width = 0) => {
    const away = S * 1.5;
    ctx.save();
    ctx.setTransform(k, 0, 0, k, S / 2 - away, S / 2);
    ctx.shadowColor = color;
    ctx.shadowBlur = blur * k;
    ctx.shadowOffsetX = away;
    ctx.fillStyle = ctx.strokeStyle = "#000";
    ctx.lineWidth = width;
    if (kind === "fill") ctx.fill(path);
    else ctx.stroke(path);
    ctx.restore();
  };
  const line = (pts: Pt[], color: string, width: number) => {
    if (pts.length < 2) return;
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (const p of pts.slice(1)) ctx.lineTo(p[0], p[1]);
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.stroke();
  };

  // the plate, and the built city's ground a shade under it
  ctx.beginPath();
  ctx.arc(0, 0, PLATE, 0, Math.PI * 2);
  ctx.fillStyle = c(GROUND.plateTop);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(0, 0, city.edge + city.lot * 0.3, 0, Math.PI * 2);
  ctx.fillStyle = c(GROUND.streets);
  ctx.fill();

  // the outskirts: their plots, their parks, and each building site's fence
  for (const d of outskirts.pads) {
    fill(d, c(GROUND.pad));
    stroke(d, c(GROUND.blockEdge), 0.5);
  }
  for (const d of outskirts.parks) lawn(d, c(GROUND.park));
  for (const d of outskirts.fences) stroke(d, c(GROUND.fence), 0.7);

  // the boulevards run on to the ledger; the river crosses them
  if (terrain.roads) fill(terrain.roads, c(GROUND.streets));
  if (terrain.river) {
    lawn(terrain.river.banks, c(GROUND.banks));
    fill(terrain.river.water, c(GROUND.water));
    stroke(terrain.river.water, c(GROUND.waterEdge), 0.9);
    // the current, a pale dashed line down the river's middle
    ctx.setLineDash([7, 11]);
    stroke(terrain.river.current, c(GROUND.current), 0.8);
    ctx.setLineDash([]);
  }

  // the streets the traffic drives, paved as busy as they are: the quiet first, so the busiest holds the street
  const order = streets.map((_, i) => i).sort((a, b) => heats[a] - heats[b]);
  for (const i of order) {
    const tone = mixHex(c(FLEET.roadLo), c(FLEET.roadHi), heats[i]);
    line(streets[i].street, tone, 0.5 * city.lot);
    for (const [a, b] of streets[i].avenues) line([a, b], tone, 0.9 * city.lot);
  }
  // the paint down each street's middle: dashes round a ring road, a double line and lane lines on a boulevard
  const dash = 0.13 * city.lot;
  const period = 0.3 * city.lot;
  ctx.strokeStyle = c(FLEET.mark);
  ctx.lineWidth = 0.035 * city.lot;
  ctx.lineCap = "butt";
  ctx.setLineDash([dash, period - dash]);
  const seenRing = new Set<string>();
  const seenWay = new Set<string>();
  for (const s of streets) {
    for (const r of s.rings) {
      const key = `${r.r.toFixed(0)}:${r.a0.toFixed(2)}:${r.a1.toFixed(2)}`;
      if (seenRing.has(key)) continue;
      seenRing.add(key);
      ctx.lineDashOffset = -r.a0 * r.r;
      ctx.beginPath();
      ctx.arc(0, 0, r.r, r.a0, r.a1);
      ctx.stroke();
    }
    for (const w of s.ways) {
      const key = `${w.bearing.toFixed(2)}:${w.r0.toFixed(0)}:${w.r1.toFixed(0)}`;
      if (seenWay.has(key)) continue;
      seenWay.add(key);
      const u: Pt = [Math.cos(w.bearing), Math.sin(w.bearing)];
      const n: Pt = [-u[1], u[0]];
      const run = (o: number, dashed: boolean) => {
        ctx.setLineDash(dashed ? [dash, period - dash] : []);
        ctx.lineDashOffset = -w.r0;
        ctx.beginPath();
        ctx.moveTo(u[0] * w.r0 + n[0] * o, u[1] * w.r0 + n[1] * o);
        ctx.lineTo(u[0] * w.r1 + n[0] * o, u[1] * w.r1 + n[1] * o);
        ctx.stroke();
      };
      const lot = city.lot;
      run(0.02 * lot, false);
      run(-0.02 * lot, false);
      for (const o of [0.157, 0.313]) {
        run(o * lot, true);
        run(-o * lot, true);
      }
    }
  }
  ctx.setLineDash([]);
  ctx.lineCap = "round";

  // the curbs: the street darkens at the foot of every block; the block's top then covers its inner half
  const curbs = new Path2D();
  for (const b of city.blocks) curbs.addPath(new Path2D(arcPath(b.a0, b.a1, b.r0 + 1.5, b.r1 - 1.5)));
  shade(curbs, c(GROUND.curb), 2.4, "stroke", 1.6);

  // the blocks' tops, their plots, and the ones no L1 stands on laid to lawn
  for (const b of city.blocks) {
    const d = arcPath(b.a0, b.a1, b.r0 + 1.5, b.r1 - 1.5);
    fill(d, c(GROUND.blockTop));
    stroke(d, c(GROUND.blockEdge), 0.6);
  }
  if (terrain.gardens) lawn(terrain.gardens, c(GROUND.garden));
  if (terrain.plots) stroke(terrain.plots, c(GROUND.plotLine), 0.5);

  // downtown's plaza: its paving, its hairline edge and its dashed ring in the brand's red, and no glow round it
  ctx.beginPath();
  ctx.arc(0, 0, city.core - 3, 0, Math.PI * 2);
  ctx.fillStyle = c(GROUND.plaza);
  ctx.fill();
  ctx.strokeStyle = c(GROUND.plazaEdge);
  ctx.lineWidth = 0.7;
  ctx.stroke();
  ctx.setLineDash([2, 3]);
  ctx.beginPath();
  ctx.arc(0, 0, city.core - 9, 0, Math.PI * 2);
  ctx.strokeStyle = c(GROUND.plazaRing);
  ctx.stroke();
  ctx.setLineDash([]);

  // a new L1's lot, fenced while it goes up
  for (const poly of sites) {
    ctx.beginPath();
    ctx.moveTo(poly[0][0], poly[0][1]);
    for (const p of poly.slice(1)) ctx.lineTo(p[0], p[1]);
    ctx.closePath();
    ctx.fillStyle = theme === "dark" ? "rgba(242,193,78,0.06)" : "rgba(217,154,6,0.06)";
    ctx.fill();
    ctx.strokeStyle = c(GROUND.fence);
    ctx.lineWidth = 0.7;
    ctx.stroke();
  }

  // a soft shade at every building's foot, where its walls meet its lot, and under every tree
  const footing = new Path2D();
  for (const f of feet) {
    if (f.round) {
      footing.moveTo(f.round[0] + f.round[2], f.round[1]);
      footing.arc(f.round[0], f.round[1], f.round[2], 0, Math.PI * 2);
    }
    else if (f.poly) {
      footing.moveTo(f.poly[0][0], f.poly[0][1]);
      for (const p of f.poly.slice(1)) footing.lineTo(p[0], p[1]);
      footing.closePath();
    }
  }
  shade(footing, c(GROUND.contact), 7);
  const canopy = new Path2D();
  for (const t of trees) {
    canopy.moveTo(t.x + t.r * 1.05, t.z);
    canopy.arc(t.x, t.z, t.r * 1.05, 0, Math.PI * 2);
  }
  shade(canopy, c(GROUND.canopy), 1.6);
}

/** the site's mono face, as the page has loaded it, for words painted in the scene */
export function monoFamily(): string {
  if (typeof document === "undefined") return "ui-monospace, monospace";
  const el = document.createElement("span");
  el.className = "font-mono";
  el.style.position = "absolute";
  el.style.visibility = "hidden";
  document.body.appendChild(el);
  const f = getComputedStyle(el).fontFamily;
  el.remove();
  return f || "ui-monospace, monospace";
}
