"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { useLiveFeed, type LivePace } from "@/components/explorer-v2/network/live-feed";
import { formatNumber } from "@/components/explorer-v2/format";
import type { LiveChain } from "@/components/explorer-v2/network/network-reads";
import type { LiveHead } from "@/lib/live-window";
import {
  LaneField,
  LaneHeight,
  LanesFrame,
  PHONE_LANES,
  PX_PER_S,
  type LanesState,
  type RenderMark,
} from "@/components/landing-v2/NetworkLanes";

/* The lanes' live part, loaded when the stats chapter nears the viewport.
   Each lane reads its chain's live window through useLiveFeed, the feed the
   Explorer's city panes read: the server holds the window and every viewer
   shares one read a tick, so the home page costs the chains' RPCs nothing
   per visitor. A lane polls only while the section is on screen (and the
   feed itself rests while the tab is hidden); with reduced motion each lane
   reads once and holds still. */

/* The clock the lanes share. A block made at `ts` sits (ts - epoch) * k px
   right of its track's origin, and the origin rides at the field's right
   edge: the edge reads `delay` ms behind the browser's clock. A block
   reaches the page 1 to 3 s after it was made, so with the edge 2 s in the
   past most blocks slide in across it, and a late one lands a few px
   short of it. */
interface Clock {
  epoch: number;
  delay: number;
}

/** how a lane's feed answered last: stale is a few missed reads, down is ten */
type FeedState = "live" | "stale" | "down";

// a block lands at NOW only if it arrives within this delay: one 2 s poll
// gap plus the answer's own time
const DELAY_MS = 4_000;
/* The route's public tick is 2 s and the CDN serves a fresh window that
   long, so a faster ask buys nothing. A stale window is not cached: every
   ask of it is a function call, so a lane whose chain answers stale rests
   15 s, then 30 s, then each minute until a fresh answer */
const LANE_PACE: LivePace = { pollMs: 2_000, staleRestMs: [15_000, 30_000, 60_000] };
/* The freshest block of the first seconds says whether the browser's clock
   agrees with the chains'. Out of this range it does not, and the edge
   follows that block instead */
const SKEW_RANGE_MS = [-1_000, 6_000] as const;
const SKEW_WINDOW_MS = 6_000;
/* a block lands red and turns gray over this long after it crosses the edge */
const LAND_MS = 2_400;
/* blocks kept behind a lane's newest: past the widest field at its pace */
const KEEP_MS = 90_000;
/* one drift animation's span; the next starts where it ends */
const DRIFT_MS = 10 * 60_000;
const PHONE_QUERY = "(max-width: 767px)";

/** a block's square: 6 px for one transaction, 16 px from about 30 */
const side = (txCount: number) => Math.round(Math.min(16, Math.max(6, 4 + 2.4 * Math.log2(1 + txCount))));

function usePhone(): boolean {
  // the live part renders only in the browser, so the first render reads the real width
  const [phone, setPhone] = useState(() => window.matchMedia(PHONE_QUERY).matches);
  useEffect(() => {
    const mql = window.matchMedia(PHONE_QUERY);
    const onChange = () => setPhone(mql.matches);
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, []);
  return phone;
}

function LiveLane({
  chain,
  armed,
  moving,
  still,
  clock,
  k,
  onArrive,
  onFeed,
}: {
  chain: LiveChain;
  /** the lane may poll */
  armed: boolean;
  /** the field drifts */
  moving: boolean;
  /** reduced motion: one read, then hold */
  still: boolean;
  clock: Clock;
  /** px a second */
  k: number;
  /** a new block reached the page this many ms after it was made */
  onArrive: (lagMs: number) => void;
  onFeed: (chainId: string, state: FeedState) => void;
}) {
  const [read, setRead] = useState(false);
  const polling = armed && !(still && read);
  const feed = useLiveFeed(polling ? chain.chainId : undefined, true, LANE_PACE);
  const held = useRef(new Map<number, LiveHead>());
  const [heads, setHeads] = useState<LiveHead[]>([]);

  // the feed drops what it held when it pauses; the lane keeps every block it has seen
  useEffect(() => {
    if (!feed.heads.length) return;
    const map = held.current;
    const fresh = feed.heads.filter((h) => !map.has(h.number));
    if (!fresh.length) return;
    for (const h of fresh) map.set(h.number, h);
    const newest = Math.max(...[...map.values()].map((h) => h.timestampMs));
    for (const [n, h] of map) if (h.timestampMs < newest - KEEP_MS) map.delete(n);
    onArrive(Date.now() - Math.max(...fresh.map((h) => h.timestampMs)));
    setRead(true);
    setHeads([...map.values()].sort((a, b) => a.number - b.number));
  }, [feed.heads, onArrive]);

  // A paused feed starts empty again, which is not news: the lane says how
  // its feed is only once the feed has answered since it was armed, and
  // keeps the last word while it rests
  const answered = feed.heads.length > 0 || feed.down;
  const [live, setLive] = useState(false);
  useEffect(() => {
    if (!polling || !answered) return;
    setLive(feed.live && !feed.down);
    onFeed(chain.chainId, feed.down ? "down" : feed.live ? "live" : "stale");
  }, [polling, answered, feed.live, feed.down, chain.chainId, onFeed]);

  const newest = heads[heads.length - 1];
  const track = useRef<HTMLSpanElement>(null);
  const drift = useRef<Animation | null>(null);
  const at = useCallback((t: number) => -((t - clock.delay - clock.epoch) * k) / 1000, [clock, k]);

  // on screen the field drifts with the clock; off screen it holds, and
  // picks the clock up again on return
  useLayoutEffect(() => {
    const el = track.current;
    if (!el) return;
    if (!moving) {
      drift.current?.pause();
      return;
    }
    const start = () => {
      const now = Date.now();
      drift.current?.cancel();
      drift.current = el.animate(
        [{ transform: `translateX(${at(now)}px)` }, { transform: `translateX(${at(now + DRIFT_MS)}px)` }],
        { duration: DRIFT_MS, easing: "linear", fill: "forwards" },
      );
      drift.current.onfinish = start;
    };
    start();
  }, [moving, at]);

  // a still lane (reduced motion) stands at the moment it read: its edge is
  // now, not 2 s back, so the block it just read is in view
  const newestNumber = newest?.number;
  useLayoutEffect(() => {
    const el = track.current;
    if (el && !moving && !drift.current) el.style.transform = `translateX(${at(Date.now() + clock.delay)}px)`;
  }, [moving, at, clock.delay, newestNumber]);

  useEffect(
    () => () => {
      drift.current?.cancel();
      drift.current = null;
    },
    [],
  );

  /* A block's red: it lands red and turns gray once it is across the edge,
     on the clock, so a block still short of the edge never takes the red
     from the one just in view. A still lane marks its newest block. */
  const land = (el: HTMLSpanElement | null, h: LiveHead) => {
    if (!el) return;
    if (still) {
      el.style.opacity = h === newest ? "1" : "0";
      return;
    }
    if (el.dataset.landed) return;
    el.dataset.landed = "1";
    const wait = h.timestampMs + clock.delay - Date.now();
    if (wait < -LAND_MS) {
      el.style.opacity = "0";
      return;
    }
    el.animate([{ opacity: 1 }, { opacity: 0 }], { duration: LAND_MS, delay: wait, easing: "ease-in", fill: "both" });
  };

  return (
    <>
      <LaneField>
        <span
          ref={track}
          className={`absolute inset-y-0 right-0 w-0 transition-opacity duration-700 ${heads.length ? "opacity-100" : "opacity-0"}`}
        >
          {heads.map((h) => {
            const s = side(h.txCount);
            return (
              <span
                key={h.number}
                className="absolute bg-[#A2AFB2] dark:bg-[#A2AFB2]/70"
                style={{
                  left: ((h.timestampMs - clock.epoch) * k) / 1000 - s / 2,
                  top: `calc(50% - ${s / 2}px)`,
                  width: s,
                  height: s,
                }}
              >
                <span ref={(el) => land(el, h)} className="absolute inset-0 bg-[#E6212F] opacity-0" />
              </span>
            );
          })}
        </span>
      </LaneField>
      {/* a still read is current as of the moment it was read: it keeps the full ink */}
      <LaneHeight value={newest ? formatNumber(newest.number) : null} live={still || live} />
    </>
  );
}

export default function NetworkLanesLive({
  chains,
  renderMark,
  active,
  still,
}: {
  chains: LiveChain[];
  renderMark: RenderMark;
  /** the section is on screen */
  active: boolean;
  still: boolean;
}) {
  const phone = usePhone();
  const k = phone ? PX_PER_S.phone : PX_PER_S.wide;

  const [clock, setClock] = useState<Clock>(() => ({ epoch: Date.now(), delay: DELAY_MS }));
  const skew = useRef<{ since: number; freshest: number; settled: boolean } | null>(null);
  const onArrive = useCallback((lag: number) => {
    const s = (skew.current ??= { since: Date.now(), freshest: lag, settled: false });
    if (s.settled) return;
    s.freshest = Math.min(s.freshest, lag);
    if (Date.now() - s.since < SKEW_WINDOW_MS) return;
    s.settled = true;
    const [lo, hi] = SKEW_RANGE_MS;
    if (s.freshest < lo || s.freshest > hi) setClock((c) => ({ ...c, delay: s.freshest + DELAY_MS / 2 }));
  }, []);

  const [feeds, setFeeds] = useState<Record<string, FeedState>>({});
  const onFeed = useCallback(
    (id: string, v: FeedState) => setFeeds((s) => (s[id] === v ? s : { ...s, [id]: v })),
    [],
  );
  const shown = phone ? chains.slice(0, PHONE_LANES) : chains;
  const states = shown.map((c) => feeds[c.chainId]);
  // an outage shows in a still read too: empty lanes would read as quiet chains
  const state: LanesState = states.every((s) => s === "down")
    ? "down"
    : still
      ? "still"
      : states.includes("live")
        ? "live"
        : "quiet";

  return (
    <LanesFrame
      chains={chains}
      renderMark={renderMark}
      state={state}
      lane={(chain, i) => (
        <LiveLane
          chain={chain}
          armed={active && !(phone && i >= PHONE_LANES)}
          moving={active && !still}
          still={still}
          clock={clock}
          k={k}
          onArrive={onArrive}
          onFeed={onFeed}
        />
      )}
    />
  );
}
