"use client";

import { useEffect, useRef, type CSSProperties } from "react";
import { EASE_OUT, cssEase } from "@/lib/motion-curves";

/* ------------------------------------------------------------------ */
/* Motion helpers shared by the /solutions surfaces                    */
/* ------------------------------------------------------------------ */

/** sol-reveals: what a scroll reveal plays, and how far into the screen its element must come before it does. */
export interface ScrollReveal {
  frames: Keyframe[];
  duration: number;
  margin: string;
}

/** A page block only fades in: one authored motion per section, its heading's. */
export const BLOCK_REVEAL: ScrollReveal = { frames: [{ opacity: 0 }, { opacity: 1 }], duration: 300, margin: "-60px" };

/** A heading line rises out of its mask: the Solutions voice, quicker. */
export const LINE_REVEAL: ScrollReveal = {
  frames: [{ transform: "translateY(105%)" }, { transform: "none" }],
  duration: 500,
  margin: "-40px",
};

/**
 * sol-reveals: plays `reveal` on `target`, `delay` seconds after `watch` comes into view, on the strong ease-out.
 * Both render in place on the server and on the first client render, so the page shows without scripts and
 * hydrates as sent. Only what is still below the screen once the page is live takes the start pose, held by the
 * paused animation: fill backwards keeps it through the delay and leaves nothing on the element once it has played.
 * Under Reduce Motion nothing hides or moves. Returns the effect's cleanup.
 */
export function revealOnScroll(watch: Element, target: Element, reveal: ScrollReveal, delay: number) {
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return undefined;
  if (watch.getBoundingClientRect().top < innerHeight) return undefined;
  const animation = target.animate(reveal.frames, {
    duration: reveal.duration,
    delay: delay * 1000,
    easing: cssEase(EASE_OUT),
    fill: "backwards",
  });
  animation.pause();
  const observer = new IntersectionObserver(
    (entries) => {
      if (!entries.some((entry) => entry.isIntersecting)) return;
      observer.disconnect();
      animation.play();
    },
    { rootMargin: reveal.margin },
  );
  observer.observe(watch);
  return () => {
    observer.disconnect();
    animation.cancel();
  };
}

/** A page block that fades in the first time it scrolls into view (sol-reveals). */
export function Reveal({
  children,
  delay = 0,
  className = "",
  id,
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
  id?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const block = ref.current;
    return block ? revealOnScroll(block, block, BLOCK_REVEAL, delay) : undefined;
  }, [delay]);
  return (
    <div ref={ref} id={id} className={className}>
      {children}
    </div>
  );
}

/** Text that rises out of a mask. By default it plays the first time it
 *  scrolls into view (sol-reveals); the mask itself watches the viewport,
 *  since the text starts outside its own clip box. With `firstPaint` it
 *  plays from the first frame instead, in CSS (.hero-enter.hero-mask in
 *  app/global.css, 800ms after `delay`): a hero's words never wait for
 *  the scripts (sol-hero-first-paint). */
export function MaskText({
  children,
  delay = 0,
  className = "",
  firstPaint = false,
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
  firstPaint?: boolean;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const mask = ref.current;
    const line = mask?.firstElementChild;
    return mask && line && !firstPaint ? revealOnScroll(mask, line, LINE_REVEAL, delay) : undefined;
  }, [delay, firstPaint]);
  return (
    <span ref={ref} className={`block overflow-hidden ${className}`}>
      {firstPaint ? (
        <span
          className="hero-enter hero-mask block [--hero-duration:800ms]"
          style={{ "--hero-delay": `${Math.round(delay * 1000)}ms` } as CSSProperties}
        >
          {children}
        </span>
      ) : (
        <span className="block">{children}</span>
      )}
    </span>
  );
}

/** Two-digit index: 1 becomes "01". */
export function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

/**
 * Sentence case for the pillar data's all-caps labels and values, keeping
 * the protocol's proper nouns and acronyms intact ("P-CHAIN REGISTRY"
 * becomes "P-Chain registry", "DEDICATED L1 FINALITY" keeps "L1").
 */
export function sentenceCase(label: string): string {
  const lower = label.toLowerCase();
  return (lower.charAt(0).toUpperCase() + lower.slice(1))
    .replace(/\b([cpx])-chain\b/gi, (_, c: string) => `${c.toUpperCase()}-Chain`)
    .replace(/\bl1(s?)\b/gi, "L1$1")
    .replace(/\b(icm|ictt|evm|dvp|fx|bls|tls|rwa)\b/gi, (m) => m.toUpperCase());
}
