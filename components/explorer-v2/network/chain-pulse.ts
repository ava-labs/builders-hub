"use client";

import { useEffect, useState } from "react";
import type { ChainPulse, ChainPulseResponse } from "@/app/api/chain-pulse/route";
import type { PchainNetwork } from "@/lib/pchain-explorer";

export type { ChainPulse };

/* Every chain's latest blocks on one network (mainnet unless asked for
   Fuji), read from its own RPC by /api/chain-pulse: when it last made a
   block and how fast it goes, keyed by chainId. Loaded on mount and every
   minute while the tab is visible; the route reads the RPCs at most once
   every two minutes on mainnet and every five on Fuji, so asking faster
   buys nothing. A tab that comes back after a minute or more loads at
   once. A load that fails keeps the last good map; a chain whose RPC
   failed is in the map with ok false and null figures. null until the
   first load, and again when the network changes. */

const POLL_MS = 60_000;

// mainnet keeps its URL as it was, so page memory and the CDN key it the same
const pulseUrl = (network: PchainNetwork) => (network === "fuji" ? "/api/chain-pulse?network=fuji" : "/api/chain-pulse");

export function useChainPulse(network: PchainNetwork = "mainnet"): Map<string, ChainPulse> | null {
  // the map with the network it is of: a map of the network before is not shown
  const [pulse, setPulse] = useState<{ network: PchainNetwork; map: Map<string, ChainPulse> } | null>(null);

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
        const res = await fetch(pulseUrl(network), { signal: controller.signal });
        if (!res.ok) return;
        const data = (await res.json()) as ChainPulseResponse;
        if (alive && Array.isArray(data?.chains)) setPulse({ network, map: new Map(data.chains.map((c) => [c.chainId, c])) });
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
  }, [network]);

  return pulse?.network === network ? pulse.map : null;
}
