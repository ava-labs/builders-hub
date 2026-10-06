"use client";

import { useEffect, useRef, useState } from "react";
import type { LiveHead, LiveTx, LiveWindow } from "@/lib/live-window";

/* A chain's live feed for the city's panes, read from /api/live/[chainId]
   once a second, or at a pace the caller sets: the server holds the
   window and every viewer shares its read, so a pane costs the node
   nothing of its own. The feed keeps a little more than the server sends,
   so a block that has left the server's window stays on the strip until
   it has slid off. Polls rest while the tab is hidden, and a feed that
   stays silent stops and says so. */

export interface LiveFeed {
  /** newest first */
  heads: LiveHead[];
  tip: LiveHead | null;
  /** newest block first, then by index; every block at or below `executedHeight` */
  txs: LiveTx[];
  executedHeight: number | null;
  /** the server answered with a fresh window within the last few polls */
  live: boolean;
  /** the feed has stopped asking; `retry` starts it again */
  down: boolean;
  retry: () => void;
}

/** how often a feed asks, and how long it rests while the server's answers stay stale */
export interface LivePace {
  pollMs: number;
  /** a stale window is served uncached, so each ask of it costs the server a read:
   *  from the second stale answer in a row the feed waits these in turn, the last
   *  one repeating, until a fresh answer. None: it keeps the poll's pace */
  staleRestMs?: readonly number[];
  /** heads the feed keeps; the panes' strip needs 14 */
  keepHeads?: number;
}

/* the city's panes: once a second, stale or not */
const PANE_PACE: LivePace = { pollMs: 1_000 };
const TIMEOUT_MS = 5_000;
const KEEP_HEADS = 14;
const KEEP_TXS = 72;
/* misses in a row before the dot goes grey, and before the feed stops asking */
const STALE_AFTER = 2;
const DOWN_AFTER = 10;

const EMPTY = { heads: [], tip: null, txs: [], executedHeight: null, live: false, down: false };

const newer = (a: LiveTx, b: LiveTx) => b.blockNumber - a.blockNumber || a.txIndex - b.txIndex;

export function useLiveFeed(chainId: string | undefined, armed = true, pace: LivePace = PANE_PACE): LiveFeed {
  const [feed, setFeed] = useState<Omit<LiveFeed, "retry">>(EMPTY);
  const [epoch, setEpoch] = useState(0);
  // the first answer can land before the pane is armed: it waits here, and shows the moment it is
  const armedRef = useRef(armed);
  const held = useRef<Omit<LiveFeed, "retry"> | null>(null);
  useEffect(() => {
    armedRef.current = armed;
    if (armed && held.current) {
      setFeed(held.current);
      held.current = null;
    }
  }, [armed]);

  useEffect(() => {
    held.current = null;
    setFeed(EMPTY);
    if (!chainId) return;
    const heads = new Map<number, LiveHead>();
    const txs = new Map<string, LiveTx>();
    let executedHeight: number | null = null;
    let misses = 0;
    let rests = 0;
    let alive = true;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const publish = (live: boolean, down: boolean) => {
      const hs = [...heads.values()].sort((a, b) => b.number - a.number).slice(0, pace.keepHeads ?? KEEP_HEADS);
      for (const h of heads.values()) if (h.number < (hs[hs.length - 1]?.number ?? 0)) heads.delete(h.number);
      const ts = [...txs.values()].sort(newer).slice(0, KEEP_TXS);
      if (txs.size > ts.length) {
        const keep = new Set(ts.map((t) => t.hash));
        for (const k of txs.keys()) if (!keep.has(k)) txs.delete(k);
      }
      const next = { heads: hs, tip: hs[0] ?? null, txs: ts, executedHeight, live, down };
      if (armedRef.current) setFeed(next);
      else held.current = next;
    };

    const poll = async () => {
      let wait = pace.pollMs;
      try {
        const res = await fetch(`/api/live/${chainId}`, { cache: "no-store", signal: AbortSignal.timeout(TIMEOUT_MS) });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const w = (await res.json()) as LiveWindow;
        if (!alive) return;
        // a sealed head never changes: the first object seen stays, so rows built on it hold still
        for (const h of w.heads) if (!heads.has(h.number)) heads.set(h.number, h);
        for (const t of w.txs) if (!txs.has(t.hash)) txs.set(t.hash, t);
        if (w.executedHeight !== null) executedHeight = Math.max(executedHeight ?? 0, w.executedHeight);
        misses = w.stale ? misses + 1 : 0;
        if (!w.stale) rests = 0;
        publish(misses < STALE_AFTER, false);
        const restMs = pace.staleRestMs;
        if (misses >= STALE_AFTER && restMs?.length) wait = restMs[Math.min(rests++, restMs.length - 1)];
      } catch {
        if (!alive) return;
        misses += 1;
        if (misses >= DOWN_AFTER) {
          publish(false, true);
          return;
        }
        if (misses >= STALE_AFTER) publish(false, false);
      }
      schedule(wait);
    };
    const schedule = (ms: number) => {
      timer = setTimeout(() => {
        if (document.visibilityState === "hidden") schedule(pace.pollMs);
        else void poll();
      }, ms);
    };
    const onVisible = () => {
      if (document.visibilityState === "visible" && alive) {
        clearTimeout(timer);
        void poll();
      }
    };
    document.addEventListener("visibilitychange", onVisible);
    void poll();
    return () => {
      alive = false;
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [chainId, epoch, pace]);

  return { ...feed, retry: () => setEpoch((e) => e + 1) };
}
