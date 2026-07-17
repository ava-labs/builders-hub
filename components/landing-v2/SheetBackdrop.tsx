"use client";

import React, { useEffect, useRef } from "react";

/* ------------------------------------------------------------------ */
/* Sheet backdrop — triangular lattice, avalanche wave, cell blips     */
/* ------------------------------------------------------------------ */

// Lattice geometry: rows H apart, triangle side S. Everything — lines,
// wave terrain, and blip triangles — derives from these two numbers inside one
// SVG coordinate space, so alignment is exact by construction. (CSS gradient
// phases are viewport-center-anchored and can never be phase-locked.)
const TRI_H = 48;
const TRI_S = TRI_H / Math.sin(Math.PI / 3); // ≈ 55.426

// Blip palette drawn from the brand guidelines' color system: brand red
// #E6212F, brand blue #0061E2, brand steel #A2AFB2, plus the sheet's own
// graphite. The background quotes the brand, not decoration.
const BLIP_FILLS = {
  red: "rgba(230,33,47,0.12)",
  blue: "rgba(0,97,226,0.10)",
  steel: "rgba(162,175,178,0.16)",
  zinc: "rgba(127,127,135,0.09)",
} as const;

// Blips: (n, row, up?, fill, delay). n indexes triangles along the row;
// vertices come from the same lattice function as the grid lines.
const BLIPS: [number, number, boolean, keyof typeof BLIP_FILLS, number][] = [
  [3, 2, true, "red", 0],
  [14, 5, false, "blue", 1.0],
  [7, 8, true, "zinc", 2.1],
  [20, 3, false, "steel", 3.2],
  [11, 10, true, "red", 4.1],
  [24, 7, false, "blue", 5.2],
  [5, 6, false, "steel", 6.3],
  [17, 9, true, "red", 7.1],
  [26, 12, true, "zinc", 8.2],
];

function rowOffset(row: number) {
  return row % 2 === 0 ? 0 : TRI_S / 2;
}

function blipPoints(n: number, row: number, up: boolean): string {
  if (up) {
    const ax = rowOffset(row) + n * TRI_S;
    const ay = row * TRI_H;
    return `${ax},${ay} ${ax - TRI_S / 2},${ay + TRI_H} ${ax + TRI_S / 2},${ay + TRI_H}`;
  }
  const ax = rowOffset(row + 1) + n * TRI_S;
  const ay = (row + 1) * TRI_H;
  return `${ax},${ay} ${ax - TRI_S / 2},${ay - TRI_H} ${ax + TRI_S / 2},${ay - TRI_H}`;
}

/* The digitized avalanche — driven by YOUR scroll, and it GROWS. Over the
   hero there are only snowballs: sparse cells popping on a loop that
   cascades downward like falling snow, leaving no mark. As you descend,
   the flurry gathers into a slide — more cells participate, the flow
   widens from the page's center line — until it is full-bleed by the
   closing chapter. The front chases your scroll ELASTICALLY (spring lag,
   never 1:1 like a scrollbar thumb) and it TRACKS BOTH WAYS: descend and
   the slide falls with you; climb back up and it rewinds, so every
   section replays its moment on every pass. Palette: graphite/white mass
   with sparse red sparks — snow and energy, nothing else. */

// the front rides this fraction of a viewport below your scroll position,
// easing toward it with ~this time constant
const AVA_LEAD = 0.75;
const AVA_TAU = 550;
// STAGING — the story is aligned to the page's chapters. Above the release
// line (measured from [data-chapter="offering"], where "One network. Two
// ways to build." begins) there is only snowfall: sparse, soft, monochrome
// cells popping on a downward-cascading loop, leaving no mark. At the
// release line the avalanche begins FULL WIDTH — the middle chapters'
// boards cover the center of the sheet, so only the margins show and a
// narrow wedge would vanish there. It gathers density (not width) on the
// way down, reaching total mass by the closing chapter.
const AVA_RELEASE_FALLBACK = 0.22; // fraction of the page, if no marker
const SNOW_DENSITY = 0.07;
const AVA_DENSITY_BASE = 0.35;
const AVA_DENSITY_RAMP = 0.85;
// tumble: how hard a cell pops and how long it churns before settling
const AVA_LIFT = 30;
const AVA_SETTLE = 700;
// downhill lean of the tumbling apexes
const AVA_DIR_X = 0.22;
const AVA_DIR_Y = 0.975;
// light falls from the upper left
const LIGHT_X = -0.45;
const LIGHT_Y = -0.89;

type WaveTri = {
  xs: [number, number, number];
  ys: [number, number, number];
  cx: number;
  cy: number;
  /** this cell's peak height, 0.5–1: the debris field's jagged relief */
  hgt: number;
  /** tumble phase: cells churn on their own beat inside the flow */
  ph: number;
  /** precomputed hit line: the frontY at which this cell is reached —
      the center of the front leads its edges, jitter frays the line */
  hl: number;
  /** hit state: -1 waiting, -2 never (outside the path or not a
      participant), else the timestamp the front reached this cell */
  hit: number;
};

function WaveCanvas({ snowOnly = false }: { snowOnly?: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    // reduced motion means still, not gone: a static settled debris field
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    let raf = 0;
    let w = 0;
    let h = 0;
    let docH = 0;
    let dpr = 1;
    let tris: WaveTri[] = [];
    // slide state: just the front's position. The chute is the page's
    // center line — the story grows in place, same for every visitor.
    // All geometry lives in HOST space (the backdrop container, which owns
    // the printed lattice) — the container starts below the navbar, so
    // document-space cells would sit visibly off the printed triangles.
    let frontY = -120;
    let originY = 0;
    let releaseY = 0;
    let fullY = 0;
    let last = 0;

    // Triangles come from the same lattice functions as the grid lines, so
    // the lifted facet lands exactly on its printed cell. Cells are built
    // in DOCUMENT space for the whole page height (~15k cells is trivial);
    // the canvas itself stays viewport-sized and pans with the scroll.
    const build = () => {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = window.innerWidth;
      h = window.innerHeight;
      // host space: the backdrop container owns the printed lattice, so
      // cells anchor to it — same origin, exact registration
      const host = canvas.parentElement!;
      const hostRect = host.getBoundingClientRect();
      originY = hostRect.top + window.scrollY;
      docH = Math.max(hostRect.height, h);
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      // the story's anchors come from the real page, not guesses: the
      // avalanche releases at the offering chapter ("One network. Two ways
      // to build.") and reaches FULL BLEED at the finale ("Launch yours.")
      // Pages without the story (solutions, pillars) opt into snowOnly —
      // the release never comes, the whole sheet stays a quiet flurry.
      if (snowOnly) {
        releaseY = docH + h;
        fullY = releaseY + 400;
      } else {
        const releaseMark = document.querySelector('[data-chapter="offering"]');
        const fullMark = document.querySelector('[data-chapter="finale"]');
        releaseY = releaseMark
          ? releaseMark.getBoundingClientRect().top + window.scrollY - originY
          : docH * AVA_RELEASE_FALLBACK;
        fullY = fullMark
          ? fullMark.getBoundingClientRect().top + window.scrollY - originY
          : docH * 0.85;
        if (fullY <= releaseY + 400) fullY = releaseY + 400;
      }
      tris = [];
      const rows = Math.ceil(docH / TRI_H) + 1;
      const cols = Math.ceil(w / TRI_S) + 2;
      // row-major top→bottom = painter's back-to-front: a lower cell's
      // pyramid correctly overlaps the apex poking up from the cell above
      for (let row = 0; row < rows; row++) {
        for (let n = -1; n < cols; n++) {
          const upAx = rowOffset(row) + n * TRI_S;
          const upAy = row * TRI_H;
          const downAx = rowOffset(row + 1) + n * TRI_S;
          const downAy = (row + 1) * TRI_H;
          const pair: [number, number, number][][] = [
            [
              [upAx, upAx - TRI_S / 2, upAx + TRI_S / 2],
              [upAy, upAy + TRI_H, upAy + TRI_H],
            ],
            [
              [downAx, downAx - TRI_S / 2, downAx + TRI_S / 2],
              [downAy, downAy - TRI_H, downAy - TRI_H],
            ],
          ];
          for (const [xs, ys] of pair) {
            const cx = (xs[0] + xs[1] + xs[2]) / 3;
            const cy = (ys[0] + ys[1] + ys[2]) / 3;
            // deterministic per-cell traits (hashes of position), stable
            // across passes and rebuilds
            const seed = Math.sin(cx * 12.9898 + cy * 78.233) * 43758.5453;
            const hgt = 0.5 + 0.5 * (seed - Math.floor(seed));
            const seed2 = Math.sin(cx * 39.3468 + cy * 11.135) * 24634.6345;
            const jit = (seed2 - Math.floor(seed2) - 0.5) * 110;
            const seed3 = Math.sin(cx * 7.13 + cy * 3.71) * 15731.743;
            const ph = (seed3 - Math.floor(seed3)) * Math.PI * 2;
            const seed4 = Math.sin(cx * 3.97 + cy * 9.21) * 37141.317;
            const u = seed4 - Math.floor(seed4);
            // membership is settled here, once. Above the release line:
            // sparse snowfall. Below it: the full-width slide, whose
            // density grows with progress toward the finale, where
            // EVERYTHING is mass.
            const lat = Math.abs(cx - 0.5 * w);
            let member: boolean;
            if (cy < releaseY) {
              member = u <= SNOW_DENSITY;
            } else {
              const prog = Math.min(1, (cy - releaseY) / (fullY - releaseY));
              member = u <= AVA_DENSITY_BASE + AVA_DENSITY_RAMP * prog;
            }
            // hit line: the center of the front leads its edges; jitter
            // frays the line
            const hl = cy + lat * 0.3 + jit;
            tris.push({ xs, ys, cx, cy, hgt, ph, hl, hit: member ? -1 : -2 });
          }
        }
      }
    };

    const tick = (now: number) => {
      raf = requestAnimationFrame(tick);
      const dt = last ? Math.min(now - last, 100) : 16;
      last = now;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      const viewY = window.scrollY - originY; // scroll position in host space
      // elastic pursuit, BOTH ways: the front eases toward a point below
      // your position — descend and it falls with you, climb and it
      // rewinds, so every section replays its moment on every pass.
      // Approaching the finale, the target blends CONTINUOUSLY down to the
      // page bottom (full coverage lands exactly as "Launch yours." snaps
      // into place) — a binary trigger here lurches and yo-yos at the edge.
      // the commit target overshoots docH: edge cells' hit lines carry the
      // chevron delay (lat*0.3 + jitter), so reaching the page's bottom
      // corners needs the front a little past the bottom itself
      const bottom = docH + 0.16 * w + 60;
      const base = Math.min(viewY + h * AVA_LEAD, bottom);
      const s = Math.min(1, Math.max(0, (viewY + h - fullY) / h));
      const commit = s * s * (3 - 2 * s); // smoothstep
      const target = base + commit * Math.max(0, bottom - base);
      frontY += (target - frontY) * (1 - Math.exp(-dt / AVA_TAU));
      const dark = document.documentElement.classList.contains("dark");
      // the canvas is a viewport window onto host space: pan by scroll
      ctx.translate(0, -viewY);
      const yMin = viewY - AVA_LIFT - 40;
      const yMax = viewY + h + 40;
      ctx.lineWidth = 1;
      for (const t of tris) {
        if (t.hit === -2) continue; // never part of the slide
        // state runs for EVERY member cell (even offscreen) so the field
        // is correct wherever you scroll next
        if (t.hit === -1) {
          if (t.hl < frontY) {
            // cells the front passed long ago (page restored mid-scroll,
            // rebuild after resize) settle instantly instead of tumbling
            t.hit = frontY - t.hl > 300 ? now - 10_000 : now;
          }
        } else if (t.hl > frontY) {
          t.hit = -1; // the front rewound above this cell — reset it
        }
        if (t.hit < 0) continue; // still waiting for the front
        // cull to the visible window
        if (t.cy < yMin || t.cy > yMax) continue;
        let g: number;
        let spark = false;
        if (t.cy < releaseY) {
          // snowball: soft, slow, monochrome, and it leaves no mark — a
          // loop whose phase advances with cy, so the flurry visibly falls
          const x = (now + t.ph * 2400 + t.cy * 3.2) % 7400;
          const flake = x < 1400 ? Math.sin((Math.PI * x) / 1400) : 0;
          g = t.hgt * flake * 0.7;
        } else {
          // slide mass stays printed as debris — the consequence you
          // scroll back up through
          ctx.beginPath();
          ctx.moveTo(t.xs[0], t.ys[0]);
          ctx.lineTo(t.xs[1], t.ys[1]);
          ctx.lineTo(t.xs[2], t.ys[2]);
          ctx.closePath();
          ctx.fillStyle = dark
            ? `rgba(250,250,250,${0.05 * t.hgt})`
            : `rgba(24,24,27,${0.05 * t.hgt})`;
          ctx.fill();
          // freshly hit cells tumble: the pyramid pops, churns on its own
          // beat, and decays onto its debris print; cells at the waiting
          // front keep simmering
          const age = now - t.hit;
          const env = Math.exp(-age / AVA_SETTLE);
          const prox = Math.max(0, 1 - Math.abs(frontY - t.cy) / 160);
          const simmer = prox * (0.12 + 0.1 * Math.sin(now / 260 + t.ph));
          g = t.hgt * Math.max(env * (0.6 + 0.4 * Math.cos(age / 110 + t.ph)), simmer);
          // sparse red sparks mark the most energetic cells in the mass
          spark = t.hgt > 0.86;
        }
        if (g < 0.05) continue;
        const lift = g * AVA_LIFT;
        // apex pitched downhill, like debris rolling forward
        const ax = t.cx + AVA_DIR_X * lift * 0.3;
        const ay = t.cy - lift + AVA_DIR_Y * lift * 0.3;
        // three faces, each shaded by how squarely it faces the light
        for (let i = 0; i < 3; i++) {
          const j = (i + 1) % 3;
          const mx = (t.xs[i] + t.xs[j]) / 2 - t.cx;
          const my = (t.ys[i] + t.ys[j]) / 2 - t.cy;
          const ml = Math.hypot(mx, my) || 1;
          const b = (mx / ml) * LIGHT_X + (my / ml) * LIGHT_Y;
          ctx.beginPath();
          ctx.moveTo(t.xs[i], t.ys[i]);
          ctx.lineTo(t.xs[j], t.ys[j]);
          ctx.lineTo(ax, ay);
          ctx.closePath();
          if (b > 0.5) {
            ctx.fillStyle = spark
              ? `rgba(230,33,47,${(dark ? 0.2 : 0.14) * g * b})`
              : dark
                ? `rgba(250,250,250,${0.1 * g * b})`
                : `rgba(24,24,27,${0.025 * g})`;
          } else {
            ctx.fillStyle = dark
              ? `rgba(250,250,250,${Math.max(0, g * (0.03 + 0.03 * b))})`
              : `rgba(24,24,27,${g * (0.05 - 0.05 * b)})`;
          }
          ctx.fill();
        }
        // crisp fold edges from each pinned corner to the apex — the
        // lattice's own hairline grammar, so the relief stays registered
        ctx.strokeStyle = dark
          ? `rgba(250,250,250,${0.16 * g})`
          : `rgba(24,24,27,${0.14 * g})`;
        ctx.beginPath();
        for (let i = 0; i < 3; i++) {
          ctx.moveTo(t.xs[i], t.ys[i]);
          ctx.lineTo(ax, ay);
        }
        ctx.stroke();
      }
    };

    // Reduced motion: still, not gone. The fully settled debris field —
    // the grown cone, printed — with zero animation; redrawn only when the
    // viewport moves. This is also what makes the backdrop exist at all on
    // iOS devices with Reduce Motion enabled.
    const drawStatic = () => {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      const viewY = window.scrollY - originY;
      ctx.translate(0, -viewY);
      const dark = document.documentElement.classList.contains("dark");
      for (const t of tris) {
        if (t.hit === -2) continue;
        if (t.cy < viewY - 40 || t.cy > viewY + h + 40) continue;
        if (t.cy < releaseY) continue; // the snowfall zone leaves no print
        ctx.beginPath();
        ctx.moveTo(t.xs[0], t.ys[0]);
        ctx.lineTo(t.xs[1], t.ys[1]);
        ctx.lineTo(t.xs[2], t.ys[2]);
        ctx.closePath();
        ctx.fillStyle = dark
          ? `rgba(250,250,250,${0.05 * t.hgt})`
          : `rgba(24,24,27,${0.05 * t.hgt})`;
        ctx.fill();
      }
    };

    const refresh = () => {
      build();
      if (reduced) drawStatic();
    };
    refresh();
    window.addEventListener("resize", refresh);
    // page height changes (images, fonts, accordions) re-anchor the field
    const ro = new ResizeObserver(refresh);
    ro.observe(document.body);
    let onScroll: (() => void) | undefined;
    if (reduced) {
      onScroll = () => {
        if (!raf) {
          raf = requestAnimationFrame(() => {
            raf = 0;
            drawStatic();
          });
        }
      };
      window.addEventListener("scroll", onScroll, { passive: true });
    } else {
      raf = requestAnimationFrame(tick);
    }
    return () => {
      window.removeEventListener("resize", refresh);
      if (onScroll) window.removeEventListener("scroll", onScroll);
      ro.disconnect();
      cancelAnimationFrame(raf);
    };
  }, [snowOnly]);

  // The canvas is position:fixed — a viewport-sized window that pans over
  // the document-space terrain (a document-height canvas would be hundreds
  // of MB of backing store). Explicit h/w required: a replaced element with
  // inset-0 sizes to its intrinsic dimensions instead of stretching.
  return <canvas ref={canvasRef} className="fixed inset-0 h-full w-full" />;
}

function LatticePattern({ id, className }: { id: string; className: string }) {
  // One tile = S wide × 2H tall: two horizontals + one diagonal per family.
  return (
    <pattern id={id} width={TRI_S} height={TRI_H * 2} patternUnits="userSpaceOnUse">
      <g className={className} strokeWidth={1}>
        <line x1={0} y1={0.5} x2={TRI_S} y2={0.5} />
        <line x1={0} y1={TRI_H + 0.5} x2={TRI_S} y2={TRI_H + 0.5} />
        <line x1={0} y1={0} x2={TRI_S} y2={TRI_H * 2} />
        <line x1={0} y1={TRI_H * 2} x2={TRI_S} y2={0} />
      </g>
    </pattern>
  );
}

export default function SheetBackdrop({ snowOnly = false }: { snowOnly?: boolean }) {
  // Document-anchored, not viewport-fixed: the lattice is the sheet of
  // paper the page is printed on, and the avalanche runs its full height —
  // scroll fast enough and you can chase the slide to the bottom.
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0">
      <style>{`
        @keyframes v2-blip { 0%, 76%, 100% { opacity: 0; } 84%, 94% { opacity: 1; } }
        /* Reduced motion must mean "still, not gone": park a static
           constellation (every third blip) instead of an empty sheet. */
        @media (prefers-reduced-motion: reduce) {
          .v2-blip { animation: none !important; }
          polygon.v2-blip:nth-of-type(3n + 1) { opacity: 1 !important; }
        }
      `}</style>

      {/* base lattice + blips share one SVG coordinate space */}
      <svg className="absolute inset-0 h-full w-full">
        <defs>
          <LatticePattern
            id="v2-tri-base"
            className="stroke-[rgba(24,24,27,0.045)] dark:stroke-[rgba(250,250,250,0.05)]"
          />
        </defs>
        <rect width="100%" height="100%" fill="url(#v2-tri-base)" />
        {BLIPS.map(([n, row, up, fill, delay], i) => (
          <polygon
            key={i}
            className="v2-blip"
            points={blipPoints(n, row, up)}
            style={{
              fill: BLIP_FILLS[fill],
              animation: `v2-blip 9s linear ${delay}s infinite`,
              opacity: 0,
            }}
          />
        ))}
      </svg>

      {/* the avalanche terrain: cells tent up as the wave crest passes —
          drawn on canvas, aligned to the lattice by construction */}
      <WaveCanvas snowOnly={snowOnly} />
    </div>
  );
}
