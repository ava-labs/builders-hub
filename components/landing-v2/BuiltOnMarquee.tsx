"use client";

import React from "react";
import { BUILT_ON_CHAINS, BuiltOnChain } from "@/components/landing-v2/builtOnChains";

/**
 * "Built on Avalanche" showcase chapter: two full-bleed counter-scrolling
 * tape rows of deployments, kept in the sheet's hairline-table grammar
 * (continuous divided cells, not floating pills). Each row is a Web
 * Animation; hover slows a row, reduced motion parks them.
 */

function TapeRow({
  chains,
  direction = "left",
  speed = 80,
}: {
  chains: BuiltOnChain[];
  direction?: "left" | "right";
  speed?: number; // seconds per half-track loop at full speed
}) {
  // 4 copies: the loop period is two copies — with ~8 names per row, two
  // copies must still exceed viewport width or the tape shows a gap.
  const doubled = [...chains, ...chains, ...chains, ...chains];

  // A Web Animation on transform, not a script that moves the row each
  // frame: the compositor plays it, so the row keeps its pace while a phone
  // scrolls and the page's own scripts run. Hover eases the row to quarter
  // speed and back through the playback rate, which keeps its place. Off
  // screen the row pauses.
  const trackRef = React.useRef<HTMLDivElement>(null);
  const hoverRef = React.useRef<(on: boolean) => void>(() => {});
  React.useEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const period = speed * 1000;
    const dir = direction === "left" ? 1 : -1;
    let anim: Animation | null = null;
    let onScreen = true;
    let rate = 1;
    let target = 1;
    let raf = 0;
    let last = 0;

    // built again when the width changes (fonts, logos), at the same point of the loop
    const build = () => {
      const half = track.scrollWidth / 2;
      if (!half) return;
      const t = anim?.currentTime;
      const at = typeof t === "number" ? t % period : 0;
      anim?.cancel();
      const from = dir > 0 ? 0 : -half;
      anim = track.animate(
        [{ transform: `translate3d(${from}px, 0, 0)` }, { transform: `translate3d(${from - dir * half}px, 0, 0)` }],
        { duration: period, iterations: Infinity },
      );
      anim.currentTime = at;
      anim.playbackRate = rate;
      if (!onScreen) anim.pause();
    };
    build();
    const ro = new ResizeObserver(build);
    ro.observe(track);
    const io = new IntersectionObserver(([e]) => {
      onScreen = e.isIntersecting;
      if (onScreen) anim?.play();
      else anim?.pause();
    });
    io.observe(track);

    const ease = (now: number) => {
      const dt = last ? Math.min((now - last) / 1000, 0.1) : 0;
      last = now;
      rate += (target - rate) * Math.min(1, dt * 5);
      if (Math.abs(target - rate) < 0.01) rate = target;
      anim?.updatePlaybackRate(rate);
      raf = rate === target ? 0 : requestAnimationFrame(ease);
    };
    hoverRef.current = (on) => {
      target = on ? 0.25 : 1;
      if (raf) return;
      last = 0;
      raf = requestAnimationFrame(ease);
    };
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
      anim?.cancel();
      hoverRef.current = () => {};
    };
  }, [direction, speed]);

  return (
    <div
      className="relative overflow-hidden"
      onMouseEnter={() => hoverRef.current(true)}
      onMouseLeave={() => hoverRef.current(false)}
    >
      <div className="pointer-events-none absolute bottom-0 left-0 top-0 z-10 w-24 bg-gradient-to-r from-white to-transparent dark:from-zinc-950" />
      <div className="pointer-events-none absolute bottom-0 right-0 top-0 z-10 w-24 bg-gradient-to-l from-white to-transparent dark:from-zinc-950" />

      <div ref={trackRef} className="flex w-max will-change-transform">
        {doubled.map((chain, i) => (
          <a
            key={`${chain.name}-${i}`}
            href={chain.link}
            target="_blank"
            rel="noopener noreferrer"
            className="flex shrink-0 items-center gap-3 border-r border-zinc-200 px-5 py-3.5 transition-colors hover:bg-zinc-100 dark:border-zinc-800 dark:hover:bg-zinc-900 lg:gap-3.5 lg:px-8 lg:py-5"
          >
            {/* one fit rule for every logo: a round chip in the brand's
                color, the mark pre-padded inside its square asset (see
                builtOnChains.ts), a hairline ring so light chips hold
                their edge on the light sheet and dark chips on the dark */}
            <span
              className="h-6 w-6 shrink-0 overflow-hidden rounded-full ring-1 ring-inset ring-zinc-950/10 dark:ring-white/15 lg:h-7 lg:w-7"
              style={{ background: chain.chip }}
            >
              <img
                src={chain.image}
                alt=""
                className="h-full w-full object-contain"
                loading="lazy"
                onError={(e) => {
                  e.currentTarget.style.display = "none";
                }}
              />
            </span>
            <span className="whitespace-nowrap text-sm font-medium text-zinc-800 dark:text-zinc-200 lg:text-base">
              {chain.name}
            </span>
          </a>
        ))}
      </div>
    </div>
  );
}

// Seconds per half-track loop of each row: slow enough to read a name as it
// passes, and different per row so the three never move in step.
const ROW_SECONDS = [112, 141, 163] as const;

export default function BuiltOnMarquee({ embedded = false }: { embedded?: boolean }) {
  if (embedded) {
    // hero fold band: no header, three tapes
    const rows: BuiltOnChain[][] = [[], [], []];
    BUILT_ON_CHAINS.forEach((chain, i) => rows[i % 3].push(chain));
    return (
      <div className="w-full divide-y divide-zinc-200 border-y border-zinc-200 bg-white/80 backdrop-blur-sm dark:divide-zinc-800 dark:border-zinc-800 dark:bg-zinc-950/80">
        <TapeRow chains={rows[0]} direction="left" speed={ROW_SECONDS[0]} />
        <TapeRow chains={rows[1]} direction="right" speed={ROW_SECONDS[1]} />
        <TapeRow chains={rows[2]} direction="left" speed={ROW_SECONDS[2]} />
      </div>
    );
  }

  // standalone section: three interleaved rows with a labelled header
  const rows: BuiltOnChain[][] = [[], [], []];
  BUILT_ON_CHAINS.forEach((chain, i) => rows[i % 3].push(chain));

  return (
    <section className="py-24 lg:py-32">
      <div className="mx-auto mb-12 flex max-w-7xl items-center gap-4 px-5 md:px-6">
        <p className="shrink-0 font-mono text-[11px] tracking-[0.22em] text-zinc-900 dark:text-zinc-100">
          BUILT ON AVALANCHE
        </p>
        <div className="h-px flex-1 bg-zinc-200 dark:bg-zinc-800" />
        <a
          href="/explorer/mainnet"
          className="shrink-0 font-mono text-[11px] tracking-[0.18em] text-zinc-500 transition-colors hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
        >
          VIEW ALL →
        </a>
      </div>

      <div className="divide-y divide-zinc-200 border-y border-zinc-200 bg-white/80 backdrop-blur-sm dark:divide-zinc-800 dark:border-zinc-800 dark:bg-zinc-950/80">
        <TapeRow chains={rows[0]} direction="left" speed={ROW_SECONDS[0]} />
        <TapeRow chains={rows[1]} direction="right" speed={ROW_SECONDS[1]} />
        <TapeRow chains={rows[2]} direction="left" speed={ROW_SECONDS[2]} />
      </div>
    </section>
  );
}
