"use client";

import Link from "next/link";
import { Suspense, lazy, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { rosterOf, type LiveChain, type RosterRow } from "@/components/explorer-v2/network/network-reads";

/* The stats chapter's live element: one lane per busy chain (the C-Chain
   and the busiest L1s by 30-day transactions), where every block the
   chain makes lands as a square at its own time (a missed slot's hole is
   drawn shorter: NetworkLanesLive) and drifts left on a clock the lanes
   share. A square's size follows its transactions. Every square
   is a real block read from the chain's live window (/api/live/[chainId]);
   nothing is simulated.

   This shell renders on the server with the lanes' names and their whole
   height, so nothing moves when the live part arrives. The live part
   (NetworkLanesLive) loads as the section nears the viewport, polls and
   drifts from 600 px out, so the lanes open full, and shows one still read
   with reduced motion. */

export const LANES = 4;
/** below md a phone reads the first two lanes, with no time axis: the
 *  chapter fits one phone screen */
export const PHONE_LANES = 2;
/** a block drifts this many px a second. The axis (md up) reads the wide
 *  pace from --k in LanesFrame's class list: keep the two in step */
export const PX_PER_S = { phone: 20, wide: 30 };

const NetworkLanesLive = lazy(() => import("@/components/landing-v2/NetworkLanesLive"));

/** "C-Chain", not "Avalanche C-Chain": the lane's label is narrow */
const laneName = (name: string) => name.replace(/^Avalanche\s+/i, "");

export type RenderMark = (chain: LiveChain) => ReactNode;

/* name, field, newest height. The row is one link into its chain's explorer */
const ROW_GRID = "grid-cols-[fit-content(7rem)_minmax(0,1fr)] md:grid-cols-[max-content_minmax(0,1fr)_6.5rem]";
const LANE_H = "h-6 md:h-7";

/** live: a feed answers. quiet: none answers yet, or the shell. still:
 *  reduced motion, one read. down: every feed has stopped answering */
export type LanesState = "live" | "quiet" | "still" | "down";

/** the frame both states share: header, one row a lane, the time axis */
export function LanesFrame({
  chains,
  renderMark,
  state,
  lane,
}: {
  chains: LiveChain[];
  renderMark: RenderMark;
  state: LanesState;
  /** a lane's field and its newest height: two grid cells */
  lane: (chain: LiveChain, index: number) => ReactNode;
}) {
  const live = state === "live";
  return (
    <div className={`grid gap-x-3 [--k:30px] md:gap-x-6 ${ROW_GRID}`}>
      <span className="col-span-2 mb-1 flex items-center gap-2 font-mono text-[10px] font-bold tracking-[0.18em] text-zinc-500 dark:text-zinc-400">
        <span className="relative flex h-1.5 w-1.5">
          {live && <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#E6212F] opacity-60" />}
          <span
            className={`relative inline-flex h-1.5 w-1.5 rounded-full ${live ? "bg-[#E6212F]" : "bg-zinc-300 dark:bg-zinc-700"}`}
          />
        </span>
        <span>
          {live ? "LIVE BLOCKS" : "LATEST BLOCKS"}
          {/* empty lanes would read as quiet chains: a feed that is down says so */}
          {state === "down" ? (
            <span> · LIVE FEED UNAVAILABLE</span>
          ) : (
            <span className="max-md:hidden"> · C-CHAIN AND THE BUSIEST L1S</span>
          )}
        </span>
        {/* phones have no axis: the edge where blocks land is named here */}
        {state !== "down" && <span className="ml-auto text-[#E6212F] md:hidden">NOW</span>}
      </span>
      <span className="mb-1 text-right font-mono text-[10px] font-bold tracking-[0.18em] text-zinc-500 max-md:hidden dark:text-zinc-400">
        NEWEST
      </span>
      {chains.map((chain, i) => (
        <Link
          key={chain.chainId}
          href={`/explorer/mainnet/${chain.slug}`}
          className={`group col-span-full grid grid-cols-subgrid items-center ${LANE_H} ${i >= PHONE_LANES ? "max-md:hidden" : ""}`}
        >
          <span className="flex min-w-0 items-center gap-2" title={chain.name}>
            {renderMark(chain)}
            <span className="truncate font-mono text-[11px] font-medium tracking-[0.06em] text-zinc-600 transition-colors group-hover:text-zinc-900 dark:text-zinc-300 dark:group-hover:text-zinc-50">
              {laneName(chain.name)}
            </span>
          </span>
          {lane(chain, i)}
        </Link>
      ))}
      {/* the clock: a tick every 10 s from now at the right edge, where blocks land */}
      <span aria-hidden className="relative col-start-2 mt-0.5 h-4 overflow-hidden border-r border-[#E6212F]/70 max-md:hidden">
        {[0, 10, 20, 30].map((s) => (
          <span key={s} className="absolute top-0 flex flex-col items-end" style={{ right: `calc(var(--k) * ${s})` }}>
            <span className="h-1 w-px bg-zinc-300 dark:bg-zinc-700" />
            <span className="mt-px translate-x-1/2 font-mono text-[9px] tabular-nums tracking-[0.08em] text-zinc-400 dark:text-zinc-500">
              {s === 0 ? "" : `${s}S`}
            </span>
          </span>
        ))}
        <span className="absolute right-1 top-1 font-mono text-[9px] font-bold tracking-[0.12em] text-[#E6212F]">NOW</span>
      </span>
    </div>
  );
}

/** a lane's field: blocks land at the right edge (the red rule) and fade off the left */
export function LaneField({ children }: { children?: ReactNode }) {
  return (
    <span
      aria-hidden
      className="relative h-full overflow-hidden border-r border-[#E6212F]/70 [mask-image:linear-gradient(to_right,transparent,black_14%)]"
    >
      <span className="absolute inset-x-0 top-1/2 h-px bg-zinc-200 dark:bg-zinc-800" />
      {children}
    </span>
  );
}

export function LaneHeight({ value, live }: { value: string | null; live: boolean }) {
  return (
    <span
      className={`truncate text-right font-mono text-[12px] tabular-nums max-md:hidden ${
        live ? "text-zinc-900 dark:text-zinc-50" : "text-zinc-400 dark:text-zinc-500"
      }`}
    >
      {value ? `#${value}` : ""}
    </span>
  );
}

const staticLane = () => (
  <>
    <LaneField />
    <LaneHeight value={null} live={false} />
  </>
);

/** The lanes, from the overview feed's chain rows. The roster is latched
 *  to its first answer, so a refresh of the figures never reshuffles them. */
export default function NetworkLanes({
  rows,
  renderMark,
  reducedMotion,
}: {
  rows: RosterRow[];
  renderMark: RenderMark;
  reducedMotion: boolean;
}) {
  const rosterRef = useRef<LiveChain[]>([]);
  const chains = useMemo(() => {
    if (rosterRef.current.length) return rosterRef.current;
    const roster = rosterOf(rows).slice(0, LANES);
    if (roster.length) rosterRef.current = roster;
    return roster;
  }, [rows]);

  const root = useRef<HTMLDivElement>(null);
  // near: load the live part. onScreen: let it poll and drift, from early
  // enough that a cold window has filled by the time the lanes are seen
  const [near, setNear] = useState(false);
  const [onScreen, setOnScreen] = useState(false);
  const hasLanes = chains.length > 0;
  useEffect(() => {
    const el = root.current;
    if (!el || !hasLanes) return;
    const loader = new IntersectionObserver(([e]) => e.isIntersecting && setNear(true), { rootMargin: "1200px 0px" });
    const watcher = new IntersectionObserver(([e]) => setOnScreen(e.isIntersecting), { rootMargin: "600px 0px" });
    loader.observe(el);
    watcher.observe(el);
    return () => {
      loader.disconnect();
      watcher.disconnect();
    };
  }, [hasLanes]);

  if (!hasLanes) return null;
  const still = <LanesFrame chains={chains} renderMark={renderMark} state="quiet" lane={staticLane} />;
  return (
    <div ref={root} role="group" aria-label="Latest blocks on the C-Chain and the busiest Avalanche L1s">
      {near ? (
        <Suspense fallback={still}>
          <NetworkLanesLive chains={chains} renderMark={renderMark} active={onScreen} still={reducedMotion} />
        </Suspense>
      ) : (
        still
      )}
    </div>
  );
}
