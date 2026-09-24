"use client";

import { useEffect, useRef, useState } from "react";

/* Something to do while the query runs. The hook follows the pointer;
   fish swim past at their own depths. Touch one with the hook and it
   bites; pull it above the waterline to land it. A hooked fish tugs,
   and one held under too long slips off. Transactions are small and
   common, blocks are worth more, and now and then a red whale swims
   through. The score lasts the session; the best is kept on this
   device. */

type Kind = "tx" | "block" | "whale";
const KINDS: Record<Kind, { pts: number; len: number; speed: [number, number]; weight: number; label: string }> = {
  tx: { pts: 1, len: 20, speed: [0.9, 1.7], weight: 70, label: "tx" },
  block: { pts: 3, len: 32, speed: [0.6, 1.1], weight: 26, label: "block" },
  whale: { pts: 10, len: 58, speed: [0.35, 0.6], weight: 4, label: "whale" },
};

interface Fish {
  id: number;
  kind: Kind;
  x: number;
  y: number;
  vx: number;
  phase: number;
  hooked: boolean;
  hookedAt: number;
}

interface Pop {
  x: number;
  y: number;
  text: string;
  born: number;
}

const WATER = 38;
const BEST_KEY = "explorer-query-fishing-best";
let sessionScore = 0;

function pickKind(): Kind {
  const total = Object.values(KINDS).reduce((a, k) => a + k.weight, 0);
  let r = Math.random() * total;
  for (const [k, v] of Object.entries(KINDS) as [Kind, (typeof KINDS)[Kind]][]) {
    if ((r -= v.weight) <= 0) return k;
  }
  return "tx";
}

export function FishingGame({ status, height = 220 }: { status: string; height?: number }) {
  const wrap = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const [score, setScore] = useState(sessionScore);
  const [best, setBest] = useState(0);
  const [hint, setHint] = useState(true);

  useEffect(() => {
    setBest(Number(localStorage.getItem(BEST_KEY) ?? 0) || 0);
  }, []);

  useEffect(() => {
    const cv = canvas.current;
    const box = wrap.current;
    if (!cv || !box) return;
    const ctx = cv.getContext("2d");
    if (!ctx) return;

    let w = box.clientWidth;
    const h = height;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const resize = () => {
      w = box.clientWidth;
      cv.width = w * dpr;
      cv.height = h * dpr;
      cv.style.width = `${w}px`;
      cv.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(box);

    // the pointer, and the hook easing toward it
    const aim = { x: w * 0.5, y: h * 0.55 };
    const hook = { x: w * 0.5, y: WATER + 30 };
    let nextId = 0;
    const spawn = (anywhere: boolean): Fish => {
      const kind = pickKind();
      const k = KINDS[kind];
      const dir = Math.random() < 0.5 ? 1 : -1;
      const speed = k.speed[0] + Math.random() * (k.speed[1] - k.speed[0]);
      return {
        id: nextId++,
        kind,
        x: anywhere ? Math.random() * w : dir > 0 ? -k.len - 10 : w + k.len + 10,
        y: WATER + 22 + Math.random() * (h - WATER - 40),
        vx: dir * speed,
        phase: Math.random() * Math.PI * 2,
        hooked: false,
        hookedAt: 0,
      };
    };
    let fish: Fish[] = Array.from({ length: 7 }, () => spawn(true));
    const pops: Pop[] = [];
    const bubbles = Array.from({ length: 14 }, () => ({ x: Math.random() * w, y: WATER + Math.random() * (h - WATER), r: 1 + Math.random() * 2, v: 0.2 + Math.random() * 0.4 }));

    const onMove = (e: PointerEvent) => {
      const r = cv.getBoundingClientRect();
      aim.x = Math.max(4, Math.min(w - 4, e.clientX - r.left));
      aim.y = Math.max(8, Math.min(h - 6, e.clientY - r.top));
    };
    cv.addEventListener("pointermove", onMove);
    cv.addEventListener("pointerdown", onMove);

    let ink = "rgb(24,24,27)";
    let faint = "rgba(24,24,27,0.16)";
    let wash = "rgba(24,24,27,0.04)";
    let paper = "rgb(255,255,255)";
    // theme colours arrive in any CSS syntax (Tailwind v4 reports oklch);
    // paint one pixel and read it back to get plain rgb to fade from
    const probe = document.createElement("canvas").getContext("2d", { willReadFrequently: true });
    const rgb = (css: string, fallback: [number, number, number]): [number, number, number] => {
      if (!probe) return fallback;
      probe.clearRect(0, 0, 1, 1);
      probe.fillStyle = "#000";
      probe.fillStyle = css;
      probe.fillRect(0, 0, 1, 1);
      const d = probe.getImageData(0, 0, 1, 1).data;
      return d[3] === 0 ? fallback : [d[0], d[1], d[2]];
    };
    const readInk = () => {
      const [r, g, b] = rgb(getComputedStyle(cv).color, [24, 24, 27]);
      ink = `rgb(${r},${g},${b})`;
      faint = `rgba(${r},${g},${b},0.16)`;
      wash = `rgba(${r},${g},${b},0.04)`;
      const dark = document.documentElement.classList.contains("dark");
      const bg = getComputedStyle(document.body).backgroundColor;
      const [pr, pg, pb] = bg && bg !== "rgba(0, 0, 0, 0)" ? rgb(bg, dark ? [9, 9, 11] : [255, 255, 255]) : dark ? [9, 9, 11] : [255, 255, 255];
      paper = `rgb(${pr},${pg},${pb})`;
    };
    readInk();

    let raf = 0;
    let frame = 0;
    let hooked: Fish | null = null;
    const tick = (now: number) => {
      frame++;
      if (frame % 90 === 0) readInk();
      ctx.clearRect(0, 0, w, h);

      // the hook eases to the pointer; a hooked fish drags it down a little
      const drag = hooked ? KINDS[hooked.kind].len / 60 : 0;
      hook.x += (aim.x - hook.x) * (0.14 - drag * 0.06);
      hook.y += (aim.y + (hooked ? 6 + Math.sin(now / 90) * 4 * (1 + drag) : 0) - hook.y) * (0.14 - drag * 0.06);

      // water
      ctx.fillStyle = wash;
      ctx.fillRect(0, WATER, w, h - WATER);
      ctx.beginPath();
      for (let px = 0; px <= w; px += 6) {
        const py = WATER + Math.sin(px / 38 + now / 700) * 2 + Math.sin(px / 13 + now / 400) * 0.8;
        if (px === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.strokeStyle = faint;
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // bubbles
      ctx.fillStyle = faint;
      for (const b of bubbles) {
        b.y -= b.v;
        if (b.y < WATER + 2) {
          b.y = h - 4;
          b.x = Math.random() * w;
        }
        ctx.beginPath();
        ctx.arc(b.x + Math.sin(b.y / 12) * 2, b.y, b.r, 0, Math.PI * 2);
        ctx.fill();
      }

      // the line, from a rod tip above the pointer, sagging a little
      const tipX = hook.x + (aim.x - hook.x) * 0.3;
      ctx.beginPath();
      ctx.moveTo(tipX, 0);
      ctx.quadraticCurveTo((tipX + hook.x) / 2 + 6, (hook.y) / 2 + 10, hook.x, hook.y - 6);
      ctx.strokeStyle = ink;
      ctx.globalAlpha = 0.55;
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.globalAlpha = 1;
      // the hook
      ctx.beginPath();
      ctx.moveTo(hook.x, hook.y - 6);
      ctx.lineTo(hook.x, hook.y + 2);
      ctx.arc(hook.x - 3, hook.y + 2, 3, 0, Math.PI, false);
      ctx.strokeStyle = hooked ? "#E6212F" : ink;
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // fish
      for (const f of fish) {
        const k = KINDS[f.kind];
        if (f.hooked) {
          f.x += (hook.x - f.x) * 0.3;
          f.y += (hook.y + k.len * 0.25 - f.y) * 0.3;
          // landed
          if (hook.y < WATER - 4) {
            sessionScore += k.pts;
            setScore(sessionScore);
            const stored = Number(localStorage.getItem(BEST_KEY) ?? 0) || 0;
            if (sessionScore > stored) {
              localStorage.setItem(BEST_KEY, String(sessionScore));
              setBest(sessionScore);
            }
            pops.push({ x: f.x, y: WATER - 6, text: `+${k.pts} ${k.label}`, born: now });
            f.hooked = false;
            hooked = null;
            Object.assign(f, spawn(false));
            setHint(false);
            continue;
          }
          // held under too long: it slips off
          if (now - f.hookedAt > 2600 + k.len * 40) {
            f.hooked = false;
            hooked = null;
            f.vx = (Math.random() < 0.5 ? -1 : 1) * k.speed[1] * 1.8;
            pops.push({ x: f.x, y: f.y - 10, text: "slipped", born: now });
          }
        } else {
          f.phase += 0.05;
          f.x += f.vx;
          f.y += Math.sin(f.phase) * 0.3;
          // shy of the hook until it is close, then it bites
          const mouthX = f.x + Math.sign(f.vx) * k.len * 0.5;
          const dx = hook.x - mouthX;
          const dy = hook.y - f.y;
          if (!hooked && hook.y > WATER && Math.hypot(dx, dy) < 9 + k.len * 0.12) {
            f.hooked = true;
            f.hookedAt = now;
            hooked = f;
          }
          if (f.x < -k.len - 20 || f.x > w + k.len + 20) Object.assign(f, spawn(false));
        }
        // draw: a body, a tail, an eye; the whale in red
        const dir = f.hooked ? -1 : Math.sign(f.vx) || 1;
        const tone = f.kind === "whale" ? "#E6212F" : ink;
        ctx.save();
        ctx.translate(f.x, f.y);
        if (f.hooked) ctx.rotate(-Math.PI / 2.4);
        ctx.scale(dir, 1);
        ctx.beginPath();
        ctx.ellipse(0, 0, k.len / 2, k.len / 5, 0, 0, Math.PI * 2);
        ctx.moveTo(-k.len / 2, 0);
        ctx.lineTo(-k.len / 2 - k.len / 4, -k.len / 5);
        ctx.lineTo(-k.len / 2 - k.len / 4, k.len / 5);
        ctx.closePath();
        ctx.fillStyle = tone;
        ctx.globalAlpha = f.kind === "tx" ? 0.55 : 0.8;
        ctx.fill();
        ctx.globalAlpha = 1;
        ctx.beginPath();
        ctx.arc(k.len / 4, -k.len / 14, Math.max(1, k.len / 22), 0, Math.PI * 2);
        ctx.fillStyle = paper;
        ctx.fill();
        if (f.kind === "block") {
          // a block carries its seal: a small square on its flank
          ctx.strokeStyle = paper;
          ctx.lineWidth = 1;
          ctx.strokeRect(-k.len / 8, -k.len / 12, k.len / 6, k.len / 6);
        }
        ctx.restore();
      }

      // score pops
      ctx.font = "10px var(--font-geist-mono), ui-monospace, monospace";
      ctx.textAlign = "center";
      for (let i = pops.length - 1; i >= 0; i--) {
        const p = pops[i];
        const age = (now - p.born) / 900;
        if (age > 1) {
          pops.splice(i, 1);
          continue;
        }
        ctx.globalAlpha = 1 - age;
        ctx.fillStyle = p.text === "slipped" ? ink : p.text.includes("whale") ? "#E6212F" : ink;
        ctx.fillText(p.text, p.x, p.y - age * 16);
      }
      ctx.globalAlpha = 1;

      // keep the pond stocked
      if (fish.length < 7 && frame % 120 === 0) fish = [...fish, spawn(false)];
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      cv.removeEventListener("pointermove", onMove);
      cv.removeEventListener("pointerdown", onMove);
    };
  }, [height]);

  return (
    <div ref={wrap} className="relative select-none overflow-hidden rounded-2xl border border-zinc-200 bg-white/60 backdrop-blur-sm dark:border-zinc-800 dark:bg-zinc-950/60">
      <canvas ref={canvas} className="block cursor-none touch-none text-zinc-900 dark:text-zinc-100" aria-label="Fishing game while the query runs" />
      <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between gap-4 px-4 py-2.5 font-mono text-[11px] tabular-nums">
        <span className="text-zinc-600 dark:text-zinc-300">{status}</span>
        <span className="flex gap-4 text-zinc-500 dark:text-zinc-400">
          <span>
            Caught <span className="text-zinc-900 dark:text-zinc-50">{score}</span>
          </span>
          <span>
            Best <span className="text-zinc-900 dark:text-zinc-50">{Math.max(best, score)}</span>
          </span>
        </span>
      </div>
      {hint && (
        <p className="pointer-events-none absolute inset-x-0 bottom-2.5 text-center font-mono text-[10px] uppercase tracking-[0.16em] text-zinc-400 dark:text-zinc-500">
          Touch a fish with the hook, then pull it above the water
        </p>
      )}
    </div>
  );
}
