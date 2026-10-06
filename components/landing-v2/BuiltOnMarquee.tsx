"use client";

import React from "react";
import { BUILT_ON_CHAINS, BuiltOnChain } from "@/components/landing-v2/builtOnChains";

/**
 * "Built on Avalanche" showcase chapter: two full-bleed counter-scrolling
 * tape rows of deployments, kept in the sheet's hairline-table grammar
 * (continuous divided cells, not floating pills). Global `marquee` keyframes;
 * hover pauses a row, reduced-motion parks both.
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

  // rAF-driven marquee instead of CSS keyframes: hover eases the row down to
  // quarter speed and back (a CSS duration change would jump the track).
  const trackRef = React.useRef<HTMLDivElement>(null);
  const hovering = React.useRef(false);
  React.useEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let half = track.scrollWidth / 2;
    const ro = new ResizeObserver(() => {
      half = track.scrollWidth / 2;
    });
    ro.observe(track);

    let offset = 0;
    let velocity = 1;
    let last = performance.now();
    let raf = 0;
    const dir = direction === "left" ? 1 : -1;

    const tick = (now: number) => {
      const dt = Math.min((now - last) / 1000, 0.1);
      last = now;
      const target = hovering.current ? 0.25 : 1;
      velocity += (target - velocity) * Math.min(1, dt * 5);
      if (half > 0) {
        offset = (offset + dir * (half / speed) * velocity * dt + half) % half;
        track.style.transform = `translate3d(${-offset}px, 0, 0)`;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, [direction, speed]);

  return (
    <div
      className="relative overflow-hidden"
      onMouseEnter={() => {
        hovering.current = true;
      }}
      onMouseLeave={() => {
        hovering.current = false;
      }}
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
