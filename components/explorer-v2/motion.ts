"use client";

import { useEffect, useRef, useState, type CSSProperties, type RefObject } from "react";

/* The explorer's motion rules, shared by every instrument: a solid rises
   from its base the first time it comes into view, a plot wipes in from
   the left, and nothing moves for a reader who asks the system for less
   motion. The keyframes live in app/global.css (bh-rise, bh-wipe,
   bh-fade-up, bh-climb, bh-flash). */

export const EASE_CSS = "cubic-bezier(0.32,0.72,0,1)";

/** the reader asked the system for less motion */
export function useStill(): boolean {
  const [still, setStill] = useState(false);
  useEffect(() => {
    const q = window.matchMedia("(prefers-reduced-motion: reduce)");
    setStill(q.matches);
    const on = () => setStill(q.matches);
    q.addEventListener("change", on);
    return () => q.removeEventListener("change", on);
  }, []);
  return still;
}

/** true from the first time the element is in view; at once for a still reader */
export function useReveal<T extends Element>(margin = "0px 0px -12% 0px"): [RefObject<T | null>, boolean] {
  const ref = useRef<T>(null);
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || shown) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches || typeof IntersectionObserver === "undefined") {
      setShown(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setShown(true);
          io.disconnect();
        }
      },
      { rootMargin: margin },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [shown, margin]);
  return [ref, shown];
}

/** an svg solid that rises from its own base once `shown`; hidden until then */
export function riseStyle(shown: boolean, delayMs = 0, ms = 720): CSSProperties {
  return {
    transformBox: "fill-box",
    transformOrigin: "50% 100%",
    ...(shown ? { animation: `bh-rise ${ms}ms ${EASE_CSS} ${delayMs}ms both` } : { transform: "scaleY(0.001)" }),
  };
}

/** a mark that fades up into place once `shown` */
export function fadeUpStyle(shown: boolean, delayMs = 0, ms = 520): CSSProperties {
  return shown ? { animation: `bh-fade-up ${ms}ms ${EASE_CSS} ${delayMs}ms both` } : { opacity: 0 };
}

/** a plot that wipes in from the left once `shown` */
export function wipeStyle(shown: boolean, ms = 900): CSSProperties {
  return shown ? { animation: `bh-wipe ${ms}ms ${EASE_CSS} both` } : { clipPath: "inset(0 100% 0 0)" };
}
