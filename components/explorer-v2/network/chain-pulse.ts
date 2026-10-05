"use client";

import { useEffect, useState } from "react";
import type { ChainPulse, ChainPulseResponse } from "@/app/api/chain-pulse/route";

export type { ChainPulse };

/* Every mainnet chain's latest blocks, read from its own RPC by
   /api/chain-pulse: when it last made a block and how fast it goes, keyed
   by chainId. Loaded on mount and every minute while the tab is visible;
   the route reads the RPCs at most once a minute, so asking faster buys
   nothing. A tab that comes back after a minute or more loads at once. A
   load that fails keeps the last good map; a chain whose RPC failed is in
   the map with ok false and null figures. null until the first load. */

const POLL_MS = 60_000;

export function useChainPulse(): Map<string, ChainPulse> | null {
  const [pulse, setPulse] = useState<Map<string, ChainPulse> | null>(null);

  useEffect(() => {
    let alive = true;
    let busy = false;
    let last = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const controller = new AbortController();

    const load = async () => {
      if (busy) return;
      busy = true;
      last = Date.now();
      try {
        const res = await fetch("/api/chain-pulse", { signal: controller.signal });
        if (!res.ok) return;
        const data = (await res.json()) as ChainPulseResponse;
        if (alive && Array.isArray(data?.chains)) setPulse(new Map(data.chains.map((c) => [c.chainId, c])));
      } catch {
        /* the last good map stands */
      } finally {
        busy = false;
      }
    };

    const schedule = (ms: number) => {
      clearTimeout(timer);
      timer = setTimeout(tick, ms);
    };
    // hidden: stop, and let the tab's return pick the clock back up
    const tick = () => {
      if (document.visibilityState === "hidden") return;
      void load();
      schedule(POLL_MS);
    };
    const onVisible = () => {
      if (document.visibilityState !== "visible") return;
      const due = POLL_MS - (Date.now() - last);
      if (due <= 0) tick();
      else schedule(due);
    };

    void load();
    schedule(POLL_MS);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      alive = false;
      controller.abort();
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  return pulse;
}
