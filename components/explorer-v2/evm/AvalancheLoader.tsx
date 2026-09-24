"use client";

import { useEffect, useRef } from "react";

/* The wait, drawn as the Avalanche mark. The mark is cut into a grid of
   cells, the same cells the block map uses. Cells fall and stack from
   the ground up until the mark stands, a light passes along its slopes,
   then the snow lets go from the peaks and slides off each flank. Then
   it builds again. The pointer pushes nearby cells aside. With reduced
   motion the mark stands still. */

const BIG =
  "M95.2 163.4h-43c-4.5 0-6.7 0-8-1a5.7 5.7 0 0 1-2.2-4.6c.1-1.6 1.3-3.5 3.5-7.3l62.7-110c2.3-3.9 3.4-5.8 4.8-6.5a5.7 5.7 0 0 1 5 0c1.4.7 2.6 2.6 4.9 6.5l12.9 22.5.1.1c2.5 4.3 3.7 6.5 4.3 8.8a19 19 0 0 1 0 9.3c-.6 2.3-1.8 4.5-4.3 9l-33 57.8-.1.2c-2.4 4.3-3.7 6.5-5.4 8.2a19 19 0 0 1-8 4.8c-2.2.8-4.7.8-9.7.8Z";
const SMALL =
  "M157.6 163.4h31.2c4.5 0 6.7 0 8-1a5.7 5.7 0 0 0 2.2-4.6c-.1-1.6-1.2-3.5-3.5-7.2l-15.7-27.2c-2.2-3.8-3.4-5.7-4.8-6.4a5.7 5.7 0 0 0-5 0c-1.3.7-2.5 2.6-4.8 6.4L149.6 151l-.1.2c-2.3 3.8-3.4 5.7-3.4 7.3a5.7 5.7 0 0 0 2.2 4.5c1.3 1 3.6 1 8 1Z";
/** the mark's box and the x of each peak, in path units */
const BOX = { x: 41, y: 32, w: 159, h: 132 };
const PEAK = { big: 112.6, small: 172.6 };

const RED: [number, number, number] = [230, 33, 47];
const PITCH = 5;
const CELL = 4;

/** one cycle, in ms */
const FILL = 2300;
const FALL = 540;
const HOLD = 1000;
const SLIDE = 1500;
const SHED = 720;
const GAP = 260;
const CYCLE = FILL + HOLD + SLIDE + GAP;

interface Cell {
  tx: number;
  ty: number;
  /** where it enters above the frame */
  sx: number;
  sy: number;
  /** when it starts to fall and when it lets go, ms into the cycle */
  drop: number;
  shed: number;
  /** which way it slides: -1 left flank, 1 right flank */
  dir: number;
  /** 0 to 1 along the slope, for the passing light */
  along: number;
  seed: number;
}

const ease = (t: number) => t * t;

export function AvalancheLoader({ status, height = 220 }: { status: string; height?: number }) {
  const wrap = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const box = wrap.current;
    const cv = canvas.current;
    const ctx = cv?.getContext("2d");
    if (!box || !cv || !ctx) return;
    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const dpr = Math.min(2, window.devicePixelRatio || 1);

    // Tailwind v4 reports colours as oklch; paint one pixel to read it back as RGB
    const probe = document.createElement("canvas").getContext("2d", { willReadFrequently: true });
    const ink = (): [number, number, number] => {
      if (!probe) return [120, 120, 130];
      probe.clearRect(0, 0, 1, 1);
      probe.fillStyle = "#000";
      probe.fillStyle = getComputedStyle(cv).color;
      probe.fillRect(0, 0, 1, 1);
      const d = probe.getImageData(0, 0, 1, 1).data;
      return [d[0], d[1], d[2]];
    };
    let inkRgb = ink();

    const big = new Path2D(BIG);
    const small = new Path2D(SMALL);
    let w = 0;
    let cells: Cell[] = [];
    let ground = 0;
    let left = 0;
    let right = 0;

    // cut the mark into cells at this size
    const layout = () => {
      w = box.clientWidth;
      cv.width = w * dpr;
      cv.height = height * dpr;
      cv.style.width = `${w}px`;
      cv.style.height = `${height}px`;
      const s = (height * 0.64) / BOX.h;
      const ox = (w - BOX.w * s) / 2;
      const oy = height * 0.16;
      ground = oy + BOX.h * s + 1;
      left = ox - 24;
      right = ox + BOX.w * s + 24;
      const hit = probe ?? ctx;
      const next: Cell[] = [];
      for (let py = oy; py < oy + BOX.h * s; py += PITCH) {
        for (let px = ox; px < ox + BOX.w * s; px += PITCH) {
          const ux = BOX.x + (px + CELL / 2 - ox) / s;
          const uy = BOX.y + (py + CELL / 2 - oy) / s;
          const onBig = hit.isPointInPath(big, ux, uy);
          if (!onBig && !hit.isPointInPath(small, ux, uy)) continue;
          const peak = onBig ? PEAK.big : PEAK.small;
          const seed = Math.random();
          next.push({
            tx: px,
            ty: py,
            sx: px + (seed - 0.5) * 30,
            sy: -CELL - seed * 50,
            drop: 0,
            shed: 0,
            dir: ux < peak ? -1 : 1,
            along: (px - ox) / (BOX.w * s),
            seed,
          });
        }
      }
      // the lowest cells fall first so the mark stacks from the ground up;
      // the highest let go first, so the snow leaves from the peaks
      const n = next.length || 1;
      const byLow = [...next].sort((a, b) => b.ty - a.ty || a.seed - b.seed);
      byLow.forEach((c, i) => (c.drop = (i / n) * (FILL - FALL) + c.seed * 120));
      const byHigh = [...next].sort((a, b) => a.ty - b.ty);
      byHigh.forEach((c, i) => (c.shed = FILL + HOLD + (i / n) * (SLIDE - SHED) + c.seed * 90));
      cells = next;
    };
    layout();
    const ro = new ResizeObserver(layout);
    ro.observe(box);

    let px = -999;
    let py = -999;
    const onMove = (e: PointerEvent) => {
      const r = cv.getBoundingClientRect();
      px = e.clientX - r.left;
      py = e.clientY - r.top;
    };
    const onLeave = () => {
      px = py = -999;
    };
    cv.addEventListener("pointermove", onMove);
    cv.addEventListener("pointerleave", onLeave);

    const t0 = performance.now();
    let raf = 0;
    const frame = (now: number) => {
      if (Math.floor(now / 1000) !== Math.floor((now - 17) / 1000)) inkRgb = ink();
      const t = still ? FILL + HOLD / 2 : (now - t0) % CYCLE;
      const [ir, ig, ib] = inkRgb;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, height);

      // the ground the mark stands on
      ctx.fillStyle = `rgba(${ir},${ig},${ib},0.14)`;
      ctx.fillRect(left, ground, right - left, 1);
      // where the mark will stand, so the frame is never empty
      ctx.fillStyle = `rgba(${ir},${ig},${ib},0.05)`;
      for (const c of cells) ctx.fillRect(c.tx, c.ty, CELL, CELL);

      // the light passes along the slopes while the mark holds
      const sweep = t > FILL && t < FILL + HOLD ? ((t - FILL) / HOLD) * 1.5 - 0.25 : -9;

      for (const c of cells) {
        let x: number;
        let y: number;
        let a = 1;
        if (t < c.drop) continue;
        if (t < c.drop + FALL) {
          const u = (t - c.drop) / FALL;
          x = c.sx + (c.tx - c.sx) * Math.min(1, u * 1.6);
          y = c.sy + (c.ty - c.sy) * ease(u);
          a = 0.35 + 0.65 * u;
        } else if (t < c.shed) {
          // a small settle after it lands
          const u = (t - c.drop - FALL) / 170;
          x = c.tx;
          y = c.ty - (u < 1 ? Math.sin(Math.PI * u) * 1.6 : 0);
        } else {
          const u = (t - c.shed) / SHED;
          if (u >= 1) continue;
          const g = ease(u);
          x = c.tx + c.dir * g * (46 + c.seed * 30);
          // the snow runs out along the ground, it does not fall through it
          y = Math.min(ground - CELL, c.ty + g * (34 + c.seed * 22));
          a = 1 - u;
          // a short trail behind each sliding cell
          ctx.fillStyle = `rgba(${RED[0]},${RED[1]},${RED[2]},${a * 0.18})`;
          ctx.fillRect(x - c.dir * 5 * u, y - 4 * u, CELL, CELL);
        }
        // the pointer pushes cells aside
        const dx = x - px;
        const dy = y - py;
        const d = Math.hypot(dx, dy);
        if (d < 34 && d > 0.01) {
          const f = (1 - d / 34) * 7;
          x += (dx / d) * f;
          y += (dy / d) * f;
        }
        // a little grain, so the mark reads as many cells and not one shape
        ctx.fillStyle = `rgba(${RED[0]},${RED[1]},${RED[2]},${a * (0.8 + c.seed * 0.2)})`;
        ctx.fillRect(x, y, CELL, CELL);
        const lit = 1 - Math.abs(c.along - sweep + (c.ty - ground) / 900) / 0.09;
        if (lit > 0) {
          ctx.fillStyle = `rgba(255,255,255,${lit * 0.6})`;
          ctx.fillRect(x, y, CELL, CELL);
        }
      }
      if (!still) raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      cv.removeEventListener("pointermove", onMove);
      cv.removeEventListener("pointerleave", onLeave);
    };
  }, [height]);

  return (
    <div ref={wrap} role="status" aria-live="polite" className="relative select-none overflow-hidden rounded-2xl border border-zinc-200 bg-white/60 backdrop-blur-sm dark:border-zinc-800 dark:bg-zinc-950/60">
      <canvas ref={canvas} className="block text-zinc-900 dark:text-zinc-100" aria-hidden="true" />
      <p className="pointer-events-none absolute inset-x-0 bottom-0 px-4 py-2.5 text-center font-mono text-[11px] tabular-nums text-zinc-600 dark:text-zinc-300">{status}</p>
    </div>
  );
}
