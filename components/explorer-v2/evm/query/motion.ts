"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useReducedMotion } from "framer-motion";

/* One motion for the whole sheet: the same curve and length for a dim,
   a crossfade, a rolling figure and a sliding pill, so every change
   reads as the same kind of change. Charts grow a little slower so a
   bar can be seen growing. */

export const EASE = [0.32, 0.72, 0, 1] as const;
export const MOTION = { duration: 0.25, ease: EASE };
export const CHART_MS = 350;
/** the same curve for css transitions on svg paths (dims) */
export const FADE_CLASS =
  "[&_path]:transition-[fill-opacity,stroke-opacity] [&_path]:duration-[250ms] [&_path]:ease-[cubic-bezier(0.32,0.72,0,1)] motion-reduce:[&_path]:transition-none";

export function useReduced(): boolean {
  return !!useReducedMotion();
}

/** a number that rolls to its new value instead of jumping; null stays null */
export function useTween(target: number | null, ms = 250): number | null {
  const reduced = useReduced();
  const [shown, setShown] = useState<number | null>(target);
  const cur = useRef<number | null>(target);

  useEffect(() => {
    if (target === null || reduced) {
      cur.current = target;
      return;
    }
    const from = cur.current ?? target;
    if (from === target) {
      cur.current = target;
      setShown(target);
      return;
    }
    const t0 = performance.now();
    let raf = 0;
    const step = (t: number) => {
      const k = Math.min(1, (t - t0) / ms);
      const e = 1 - Math.pow(1 - k, 3);
      const v = from + (target - from) * e;
      cur.current = v;
      setShown(v);
      if (k < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target, reduced, ms]);

  return target === null || reduced ? target : shown;
}

/** a phone-width viewport; charts give their axes less room there */
export function useNarrow(): boolean {
  return useSyncExternalStore(
    (fn) => {
      const m = window.matchMedia("(max-width: 639px)");
      m.addEventListener("change", fn);
      return () => m.removeEventListener("change", fn);
    },
    () => window.matchMedia("(max-width: 639px)").matches,
    () => false,
  );
}
