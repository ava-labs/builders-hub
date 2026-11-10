"use client";

import { useLayoutEffect, useRef } from "react";
import { cn } from "@/lib/utils";

/* The wait, drawn as the city builds: the answer under construction. A
   small plate in isometric view, and on it three towers that stand as a
   bar chart and rise storey by storey, each storey settling on the
   brand's curve. As a floor lands, its window ribbon comes on in a
   district's glass; when the three stand, a light passes once along
   them, as the city's light wave does. They hold, clear, and build again
   to other heights. The city's white model by day and graphite by night,
   lit from the left as the city is: a lit left face, a shaded right face,
   a pale roof. A 2D canvas, since the city's own canvas holds the GPU; it
   stops while the tab is hidden. With reduced motion the three stand
   still, lit. */

type Rgb = [number, number, number];
const rgb = (hex: string): Rgb => [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)];
const mix = (a: Rgb, b: Rgb, u: number): Rgb => [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u, a[2] + (b[2] - a[2]) * u];
const css = (c: Rgb) => `rgb(${c[0] | 0},${c[1] | 0},${c[2] | 0})`;

interface Ink {
  plate: string;
  /** the plate's two sides: the lit left one and the shaded right one */
  plateLit: string;
  plateShade: string;
  /** the hairline where the plate's top meets its sides */
  rim: string;
  lot: string;
  roof: string;
  /** a tower's two faces, lit and shaded */
  lit: Rgb;
  shade: Rgb;
  edge: string;
  /** a ribbon before its floor's lights come on, on each face */
  dim: [Rgb, Rgb];
  /** each tower's glass, lit and shaded */
  glass: [Rgb, Rgb][];
  /** the passing light, and how far it brightens a lit ribbon toward it */
  flash: Rgb;
  pass: number;
}

/* The city's colors, copied from city3d/palette.ts (MASS3, GROUND, ROOF,
   GLASS_BASE) and city-model.ts (GLASS): palette.ts reads the city's plan,
   which the Query page does not load. The glass is made as the city makes
   it: a cool blue-gray by day and a lit room's calm white by night, lit at
   seven tenths, each tinted by its district's hue; the three are the
   calmest districts', Enterprise sapphire, AI aqua and Finance emerald. */
const HUES = { light: ["#6B89C0", "#5F9FAD", "#5D9879"], dark: ["#93ADDC", "#87C3D0", "#8BC8A6"] };
/** a ribbon's lit glass on each face: the base tinted by the hue, over the face it is set in */
const glassOf = (base: string, hue: string, lit: Rgb, shade: Rgb, k: number): [Rgb, Rgb] => {
  const g = mix(rgb(base), rgb(hue), 0.5);
  return [mix(lit, g, k), mix(shade, g, k * 0.86)];
};
const BY_DAY = { lit: rgb("#EEF1F5"), shade: rgb("#D3DAE3") };
const BY_NIGHT = { lit: rgb("#3B434B"), shade: rgb("#2B3036") };
const INK: Record<"light" | "dark", Ink> = {
  light: {
    plate: "#E3E9F1",
    plateLit: "#C9D3DF",
    plateShade: "#B7C1CE",
    rim: "rgba(255,255,255,0.9)",
    lot: "rgba(30,40,55,0.12)",
    roof: "#FAFBFD",
    lit: BY_DAY.lit,
    shade: BY_DAY.shade,
    edge: "rgba(140,152,166,0.55)",
    dim: [mix(BY_DAY.lit, rgb("#6E7F92"), 0.2), mix(BY_DAY.shade, rgb("#6E7F92"), 0.2)],
    glass: HUES.light.map((hue) => glassOf("#6E7F92", hue, BY_DAY.lit, BY_DAY.shade, 0.72)),
    flash: rgb("#FFFFFF"),
    pass: 0.5,
  },
  dark: {
    plate: "#262A2F",
    plateLit: "#3B484B",
    plateShade: "#2C3638",
    rim: "rgba(255,255,255,0.08)",
    lot: "rgba(255,255,255,0.07)",
    roof: "#434D55",
    lit: BY_NIGHT.lit,
    shade: BY_NIGHT.shade,
    edge: "rgba(79,91,102,0.9)",
    dim: [rgb("#23282D"), rgb("#1C2024")],
    glass: HUES.dark.map((hue) => glassOf("#EBF0FA", hue, BY_NIGHT.lit, BY_NIGHT.shade, 0.7)),
    flash: rgb("#FFFFFF"),
    pass: 0.6,
  },
};

/** the brand's curve, cubic-bezier(0.16, 1, 0.3, 1): fast attack, long decay; a table of y by x */
const BRAND = (() => {
  const at = (t: number, p1: number, p2: number) => 3 * (1 - t) * (1 - t) * t * p1 + 3 * (1 - t) * t * t * p2 + t * t * t;
  const n = 64;
  const ys = new Float32Array(n + 1);
  for (let i = 0; i <= n; i++) {
    let lo = 0;
    let hi = 1;
    for (let k = 0; k < 24; k++) {
      const mid = (lo + hi) / 2;
      if (at(mid, 0.16, 0.3) < i / n) lo = mid;
      else hi = mid;
    }
    ys[i] = at((lo + hi) / 2, 1, 1);
  }
  return (x: number) => {
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    const f = x * n;
    const i = f | 0;
    return ys[i] + (ys[i + 1] - ys[i]) * (f - i);
  };
})();

/* the plan, in units of a tower's width: three towers on the plate's
   long diagonal, so they stand side by side as bars do */
const PITCH = 1.35;
const HALF = PITCH + 0.5 + 0.3;
const STOREY = 0.32;
/** the most storeys a tower takes */
const MOST = 9;
const SLAB = 0.18;
/** a unit of height on screen, against the plan's: the city's tilt of one half */
const RISE = 1.2247;
/** where each tower stands on the plan */
const AT: [number, number][] = [
  [-PITCH, PITCH],
  [0, 0],
  [PITCH, -PITCH],
];
/** each round's heights in storeys: a new chart each time */
const ROUNDS = [
  [5, 9, 7],
  [7, 5, 8],
  [4, 8, 6],
  [6, 9, 5],
];

/** one round, in ms: the towers rise, their lights come on, a light passes, they hold, then clear */
const STEP = 150;
const STAGGER = 110;
const LAND = 480;
/** a storey falls from this share of its height above its place */
const DROP = 0.5;
const LIGHT_AFTER = 200;
const LIGHT = 420;
const WAVE_AT = 2 * STAGGER + (MOST - 1) * STEP + LIGHT_AFTER + LIGHT + 120;
const WAVE = 900;
const CLEAR_AT = WAVE_AT + WAVE + 360;
const CLEAR = 420;
const CYCLE = CLEAR_AT + CLEAR + 260;
/** what reduced motion shows: the three standing, lit */
const STILL_T = CLEAR_AT - 1;

/** the plan's extent on screen, in units: above the plan's origin and below it, and half its width */
const TOP = 0.5 + (MOST * STOREY + DROP * STOREY) * RISE;
const BOTTOM = HALF + SLAB * RISE;
const HALF_W = 2 * HALF;

/* a loader that takes over from one just gone keeps its clock: the frame a
   search box's shell draws on Enter hands over to the Query page's own,
   and the towers rise on unbroken */
const HANDOFF_MS = 400;
let handoff = { t0: 0, at: -Infinity };

/** the tallest the group grows, so a tall box gets air around it */
const GROUP_MAX = 150;
/** the status line's height and its distance under the plate */
const STATUS_H = 16;
const STATUS_GAP = 16;

export function QueryLoader({
  status,
  height = 220,
  fill = false,
  framed = true,
}: {
  status: string;
  /** the box's height; ignored when it fills its parent */
  height?: number;
  /** take the parent's height (a board that stretches to its row) */
  fill?: boolean;
  /** its own card; off inside a board that already frames it */
  framed?: boolean;
}) {
  const wrap = useRef<HTMLDivElement>(null);
  const statusEl = useRef<HTMLParagraphElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);

  // laid out before the first paint, so the status line never shows out of place
  useLayoutEffect(() => {
    const box = wrap.current;
    const cv = canvas.current;
    const ctx = cv?.getContext("2d");
    if (!box || !cv || !ctx) return;
    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const root = document.documentElement;
    let ink = INK[root.classList.contains("dark") ? "dark" : "light"];

    let w = 0;
    let h = 0;
    // a unit of the plan on screen, and the plan's origin
    let u = 1;
    let ox = 0;
    let oy = 0;
    const layout = () => {
      w = box.clientWidth;
      h = box.clientHeight;
      cv.width = w * dpr;
      cv.height = h * dpr;
      cv.style.width = `${w}px`;
      cv.style.height = `${h}px`;
      // the plate, its towers and the status line under it are one group,
      // centered in the frame and lifted a touch, since the eye reads the
      // true middle as low
      const groupH = Math.min((h - STATUS_GAP - STATUS_H) * 0.72, GROUP_MAX);
      u = Math.min(groupH / (TOP + BOTTOM), (w * 0.8) / (2 * HALF_W));
      const top = Math.max(8, (h - ((TOP + BOTTOM) * u + STATUS_GAP + STATUS_H)) / 2 - h * 0.02);
      ox = w / 2;
      oy = top + TOP * u;
      if (statusEl.current) {
        statusEl.current.style.top = `${oy + BOTTOM * u + STATUS_GAP}px`;
        statusEl.current.style.visibility = "visible";
      }
    };

    // the plan to the screen: x runs down to the right, y down to the left, z up
    const sx = (x: number, y: number) => ox + (x - y) * u;
    const sy = (x: number, y: number, z: number) => oy + (x + y) * 0.5 * u - z * RISE * u;
    const path = (g: CanvasRenderingContext2D, pts: number[]) => {
      g.beginPath();
      g.moveTo(pts[0], pts[1]);
      for (let i = 2; i < pts.length; i += 2) g.lineTo(pts[i], pts[i + 1]);
      g.closePath();
    };
    const quad = (g: CanvasRenderingContext2D, pts: number[], fill: string) => {
      path(g, pts);
      g.fillStyle = fill;
      g.fill();
    };
    // the clear fades the three as one layer, so no face shows through another
    const layer = document.createElement("canvas");
    const lctx = layer.getContext("2d");

    /** one tower at time t: its storeys that have begun to land, bottom up */
    const tower = (g: CanvasRenderingContext2D, i: number, t: number, storeys: number, wave: number) => {
      const [cx, cy] = AT[i];
      const x0 = cx - 0.5;
      const x1 = cx + 0.5;
      const y0 = cy - 0.5;
      const y1 = cy + 0.5;
      const start = i * STAGGER;
      const n = Math.min(storeys, Math.max(0, Math.floor((t - start) / STEP) + 1));
      if (n === 0) return;
      const glass = ink.glass[i];
      // the passing light's place along the row, where this tower stands in it
      const along = (i * 2 * PITCH + 1) / (4 * PITCH + 2);
      for (let k = 0; k < n; k++) {
        const since = t - start - k * STEP;
        const z0 = (k + DROP * (1 - BRAND(since / LAND))) * STOREY;
        const z1 = z0 + STOREY;
        g.globalAlpha = Math.min(1, since / 40);
        // the passing light, rising a little as it crosses the tower
        const pass = Math.max(0, 1 - Math.abs(along - wave + (k / MOST) * 0.12) / 0.16);
        // the lit left face, the shaded right face
        quad(g, [sx(x0, y1), sy(x0, y1, z0), sx(x1, y1), sy(x1, y1, z0), sx(x1, y1), sy(x1, y1, z1), sx(x0, y1), sy(x0, y1, z1)], css(mix(ink.lit, ink.flash, pass * 0.2)));
        quad(g, [sx(x1, y1), sy(x1, y1, z0), sx(x1, y0), sy(x1, y0, z0), sx(x1, y0), sy(x1, y0, z1), sx(x1, y1), sy(x1, y1, z1)], css(mix(ink.shade, ink.flash, pass * 0.1)));
        // the storey's window ribbon on each face: its glass comes on once it lands, and brightens as the light passes
        const on = BRAND((since - LIGHT_AFTER) / LIGHT);
        const r0 = z0 + STOREY * 0.34;
        const r1 = z0 + STOREY * 0.74;
        for (let f = 0; f < 2; f++) {
          const c = mix(mix(ink.dim[f], glass[f], on), ink.flash, pass * (f === 0 ? ink.pass : ink.pass * 0.66));
          const [ax, ay, bx, by] = f === 0 ? [x0, y1, x1, y1] : [x1, y1, x1, y0];
          const px0 = ax + (bx - ax) * 0.1;
          const py0 = ay + (by - ay) * 0.1;
          const px1 = ax + (bx - ax) * 0.9;
          const py1 = ay + (by - ay) * 0.9;
          quad(g, [sx(px0, py0), sy(px0, py0, r0), sx(px1, py1), sy(px1, py1, r0), sx(px1, py1), sy(px1, py1, r1), sx(px0, py0), sy(px0, py0, r1)], css(c));
        }
        // the roof, pale, while nothing stands on it yet, with its crisp edge
        if (k === n - 1 || t - start - (k + 1) * STEP < 40) {
          quad(g, [sx(x0, y0), sy(x0, y0, z1), sx(x1, y0), sy(x1, y0, z1), sx(x1, y1), sy(x1, y1, z1), sx(x0, y1), sy(x0, y1, z1)], ink.roof);
          g.strokeStyle = ink.edge;
          g.lineWidth = 0.75;
          g.stroke();
        }
      }
      // the massing's front corner
      g.globalAlpha = 1;
      g.beginPath();
      g.moveTo(sx(x1, y1), sy(x1, y1, 0));
      g.lineTo(sx(x1, y1), sy(x1, y1, n * STOREY));
      g.strokeStyle = ink.edge;
      g.lineWidth = 0.75;
      g.stroke();
    };

    const draw = (t: number, round: number) => {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      const heights = ROUNDS[round % ROUNDS.length];

      // the plate: its two sides, its top, and the rim where they meet
      const drop = SLAB * RISE * u;
      const L = [sx(-HALF, HALF), sy(-HALF, HALF, 0)];
      const B = [sx(HALF, HALF), sy(HALF, HALF, 0)];
      const R = [sx(HALF, -HALF), sy(HALF, -HALF, 0)];
      const T = [sx(-HALF, -HALF), sy(-HALF, -HALF, 0)];
      quad(ctx, [L[0], L[1], B[0], B[1], B[0], B[1] + drop, L[0], L[1] + drop], ink.plateLit);
      quad(ctx, [B[0], B[1], R[0], R[1], R[0], R[1] + drop, B[0], B[1] + drop], ink.plateShade);
      quad(ctx, [T[0], T[1], R[0], R[1], B[0], B[1], L[0], L[1]], ink.plate);
      ctx.beginPath();
      ctx.moveTo(L[0], L[1]);
      ctx.lineTo(B[0], B[1]);
      ctx.lineTo(R[0], R[1]);
      ctx.strokeStyle = ink.rim;
      ctx.lineWidth = 1;
      ctx.stroke();
      // each tower's lot, a hairline on the plate, so the frame is never empty
      ctx.strokeStyle = ink.lot;
      for (const [cx, cy] of AT) {
        const m = 0.62;
        path(ctx, [sx(cx - m, cy + m), sy(cx - m, cy + m, 0), sx(cx + m, cy + m), sy(cx + m, cy + m, 0), sx(cx + m, cy - m), sy(cx + m, cy - m, 0), sx(cx - m, cy - m), sy(cx - m, cy - m, 0)]);
        ctx.stroke();
      }

      if (t >= CLEAR_AT + CLEAR) return;
      const wave = t < WAVE_AT || t > WAVE_AT + WAVE ? -9 : ((t - WAVE_AT) / WAVE) * 1.5 - 0.25;
      if (t < CLEAR_AT || !lctx) {
        for (let i = 0; i < 3; i++) tower(ctx, i, t, heights[i], wave);
        return;
      }
      // the clear: the three, drawn whole on the layer, fade out as one
      if (layer.width !== cv.width || layer.height !== cv.height) {
        layer.width = cv.width;
        layer.height = cv.height;
      }
      lctx.setTransform(1, 0, 0, 1, 0, 0);
      lctx.clearRect(0, 0, layer.width, layer.height);
      lctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      for (let i = 0; i < 3; i++) tower(lctx, i, t, heights[i], wave);
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.globalAlpha = 1 - BRAND((t - CLEAR_AT) / CLEAR);
      ctx.drawImage(layer, 0, 0);
      ctx.globalAlpha = 1;
    };

    const start = performance.now();
    const t0 = start - handoff.at < HANDOFF_MS ? handoff.t0 : start;
    let raf = 0;
    const frame = (now: number) => {
      // a frame's time can come a hair before the effect's own clock; the first round starts at 0
      const e = Math.max(0, now - t0);
      draw(e % CYCLE, Math.floor(e / CYCLE));
      raf = requestAnimationFrame(frame);
    };
    const run = () => {
      cancelAnimationFrame(raf);
      if (still) draw(STILL_T, 0);
      else if (document.visibilityState === "visible") raf = requestAnimationFrame(frame);
    };
    layout();
    run();
    const ro = new ResizeObserver(() => {
      layout();
      if (still) draw(STILL_T, 0);
    });
    ro.observe(box);
    // the site's theme is a class on the root
    const mo = new MutationObserver(() => {
      ink = INK[root.classList.contains("dark") ? "dark" : "light"];
      if (still) draw(STILL_T, 0);
    });
    mo.observe(root, { attributes: true, attributeFilter: ["class"] });
    document.addEventListener("visibilitychange", run);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      mo.disconnect();
      document.removeEventListener("visibilitychange", run);
      handoff = { t0, at: performance.now() };
    };
  }, []);

  return (
    <div
      role="status"
      aria-live="polite"
      style={fill ? undefined : { height }}
      className={cn(
        "relative flex select-none flex-col overflow-hidden",
        fill && "h-full min-h-[18rem]",
        framed && "rounded-2xl border border-zinc-200 bg-white/60 backdrop-blur-sm dark:border-zinc-800 dark:bg-zinc-950/60",
      )}
    >
      <div ref={wrap} className="relative min-h-0 flex-1">
        <canvas ref={canvas} className="absolute inset-0 block" aria-hidden="true" />
        {/* placed by the layout, under the plate; hidden until then, so the server's HTML does not show it out of place */}
        <p ref={statusEl} className="pointer-events-none invisible absolute inset-x-0 px-4 text-center font-mono text-[11px] leading-4 tabular-nums text-zinc-600 dark:text-zinc-300">
          {status}
        </p>
      </div>
    </div>
  );
}
