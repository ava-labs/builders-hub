'use client';

import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';

/**
 * Chained-clip video sequencer for the console home page.
 *
 * Plays a sequence of short webm clips (1-second each) as a seamless
 * loop: `reveal.webm` → `1.webm` → `2.webm` → ... → `8.webm` → back
 * to `reveal.webm`. All clips — including the intro — participate in
 * every cycle.
 *
 * Implementation:
 *   - Two stacked `<video>` elements act as a double-buffer. One plays
 *     on-screen while the other preloads the *next* clip.
 *   - **Pre-warm on timeupdate**: when the active clip has ~150ms left,
 *     we kick the inactive slot into `play()` so its decoder is already
 *     past the startup pause by the time we flip visibility. Without
 *     this, the incoming video held on its first frame for a noticeable
 *     beat before motion began.
 *   - **Instant swap** (no cross-fade). A 75ms opacity transition makes
 *     both videos partially visible simultaneously, which looks worse
 *     than a hard cut — these clips are authored to butt-join cleanly.
 *   - On mount we also `fetch(..., { cache: 'force-cache' })` every
 *     clip, which warms the HTTP cache so later `<video>` loads reuse
 *     the bytes.
 *
 * Accessibility: muted + aria-hidden. Users with
 * `prefers-reduced-motion` get the first frame of `reveal.webm` as a
 * static image, no animation.
 */

const BASE = '/videos/alpha';
/** Ordered playlist. `reveal` is part of every cycle. Clip `6` was
 *  the LFJ-branded one and is intentionally skipped. */
const PLAYLIST = ['reveal', '1', '2', '3', '4', '5', '7', '8'] as const;
/** Index the loop wraps to after the last clip (start of the cycle). */
const LOOP_START = 0;

type Slot = 0 | 1;

function srcFor(idx: number): string {
  return `${BASE}/${PLAYLIST[idx]}.webm`;
}

function nextIndex(cur: number): number {
  // 0 (reveal) → 1; last → LOOP_START; otherwise +1.
  if (cur >= PLAYLIST.length - 1) return LOOP_START;
  return cur + 1;
}

export function AlphaSequence({ className }: { className?: string }) {
  const [reducedMotion, setReducedMotion] = useState(false);

  // Which of the two video slots is currently visible (and playing).
  const [activeSlot, setActiveSlot] = useState<Slot>(0);

  // Index into PLAYLIST for each slot. Slot 0 starts on reveal; slot 1
  // is primed with the clip that follows so the very first handoff is
  // also pre-warmed.
  const [slotIdx, setSlotIdx] = useState<[number, number]>([0, 1]);

  const videoRefs = [useRef<HTMLVideoElement>(null), useRef<HTMLVideoElement>(null)];

  // Detect reduced-motion up-front so we never autoplay for those users.
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReducedMotion(mq.matches);
    const handler = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  // Warm the HTTP cache for every clip on mount. Done once; `force-cache`
  // ensures subsequent <video> loads reuse the bytes.
  useEffect(() => {
    PLAYLIST.forEach((name) => {
      fetch(`${BASE}/${name}.webm`, { cache: 'force-cache' }).catch(() => {
        /* network hiccup is fine — the <video> element will retry */
      });
    });
  }, []);

  // When the active slot's clip ends, swap to the inactive slot (which
  // has been preloading the *next* clip) and queue the clip *after*
  // that into the slot we just left.
  const handleEnded = (slot: Slot) => () => {
    if (slot !== activeSlot) return; // Ignore stale ended events.

    const other = (slot === 0 ? 1 : 0) as Slot;
    setActiveSlot(other);
    setSlotIdx((prev) => {
      const upcoming = prev[other]; // what the other slot is about to play
      const followup = nextIndex(upcoming); // what comes after
      const out: [number, number] = [...prev] as [number, number];
      out[slot] = followup;
      return out;
    });
  };

  // Pre-warm: when the active clip is near its end, kick the inactive
  // slot's video into play() so it's past decoder startup by the time
  // we swap visibility on `ended`. The inactive slot is positioned at
  // opacity-0 so this pre-roll isn't visible; it just lets the first
  // ~5 frames of the next clip decode early.
  const handleTimeUpdate = (slot: Slot) => (e: React.SyntheticEvent<HTMLVideoElement>) => {
    if (slot !== activeSlot) return;
    const v = e.currentTarget;
    if (!v.duration || Number.isNaN(v.duration)) return;
    if (v.duration - v.currentTime > 0.15) return; // Too early.
    const other = (slot === 0 ? 1 : 0) as Slot;
    const otherVideo = videoRefs[other].current;
    if (!otherVideo) return;
    if (otherVideo.paused) {
      otherVideo.currentTime = 0;
      otherVideo.play().catch(() => {
        /* autoplay policies; the ended swap will cover it */
      });
    }
  };

  // Whenever a slot's target clip changes, load it and (if active) play.
  useEffect(() => {
    [0, 1].forEach((slot) => {
      const v = videoRefs[slot].current;
      if (!v) return;
      const desiredSrc = new URL(srcFor(slotIdx[slot]), window.location.origin).href;
      if (v.src !== desiredSrc) {
        v.src = desiredSrc;
        v.load();
      }
      if (slot === activeSlot && !reducedMotion) {
        v.currentTime = 0;
        v.play().catch(() => {
          /* autoplay blocked — muted + playsInline should satisfy most policies */
        });
      }
    });
    // videoRefs identity is stable; intentionally excluded.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slotIdx, activeSlot, reducedMotion]);

  if (reducedMotion) {
    // Static single frame — no looping motion for motion-sensitive users.
    return (
      <video
        className={cn('block h-full w-full object-contain select-none pointer-events-none', className)}
        muted
        playsInline
        aria-hidden="true"
        preload="metadata"
        // Point at reveal; browser renders first frame as poster-less fallback.
        src={srcFor(0)}
      />
    );
  }

  return (
    <div className={cn('relative', className)} aria-hidden="true">
      {[0, 1].map((slot) => (
        <video
          key={slot}
          ref={videoRefs[slot]}
          className={cn(
            'absolute inset-0 h-full w-full object-contain select-none pointer-events-none',
            slot === activeSlot ? 'opacity-100' : 'opacity-0',
          )}
          muted
          playsInline
          preload="auto"
          onEnded={handleEnded(slot as Slot)}
          onTimeUpdate={handleTimeUpdate(slot as Slot)}
        />
      ))}
    </div>
  );
}
