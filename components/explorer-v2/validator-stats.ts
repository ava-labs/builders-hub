"use client";

import { useEffect, useMemo, useState } from "react";
import type { SubnetStats } from "@/types/validator-stats";

/* The P-Chain liveness feed, shared by every explorer surface that asks
   "which sets have stake-backed validators right now": the chain switcher,
   the portal doors, the chains directory, the validators facet, the P-Chain
   home strip. One module-level promise per network so simultaneous mounts
   (the subnav plus the page body, on every explorer view) share a single
   request instead of racing seven copies of the same fetch. */

// one canonical id, under its post-Avalanche9000 name
export { PRIMARY_SUBNET_ID as PRIMARY_NETWORK_ID } from "@/lib/pchain-node";

const inflight = new Map<string, Promise<SubnetStats[]>>();

export function fetchValidatorStats(network = "mainnet"): Promise<SubnetStats[]> {
  let p = inflight.get(network);
  if (!p) {
    // no-store: the route sends max-age=86400 for the CDN, but letting the
    // browser hold it a day means one cached bad response (an outage's 500,
    // a stale 206) pins every consumer to a dash until the entry expires
    p = fetch(`/api/validator-stats?network=${network}`, { cache: "no-store" }).then((res) => {
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json() as Promise<SubnetStats[]>;
    });
    // a failed fetch shouldn't poison the session; let the next caller retry
    p.catch(() => inflight.delete(network));
    inflight.set(network, p);
  }
  return p;
}

/* subnetId → connected node count, counting only sets that are actually
   validated right now. The liveness rule every consumer shares. */
export function liveValidatorCounts(subnets: SubnetStats[]): Map<string, number> {
  const live = new Map<string, number>();
  for (const s of subnets) {
    const nodes = Object.values(s.byClientVersion ?? {}).reduce((sum, v) => sum + v.nodes, 0);
    if (nodes > 0) live.set(s.id, nodes);
  }
  return live;
}

/* `enabled` keeps the lazy callers lazy: the switcher fetches on first
   open, the portal's name search on the first two typed characters. */
export function useValidatorStats(network = "mainnet", enabled = true) {
  const [subnets, setSubnets] = useState<SubnetStats[] | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    setSubnets(null);
    setError(false);
    fetchValidatorStats(network)
      .then((s) => {
        if (!cancelled) setSubnets(s);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      });
    return () => {
      cancelled = true;
    };
  }, [network, enabled]);

  return { subnets, error, loading: enabled && subnets === null && !error };
}

/* The common derived view, memoized: null while the feed is loading or off. */
export function useLiveValidatorCounts(network = "mainnet", enabled = true) {
  const { subnets, error } = useValidatorStats(network, enabled);
  const live = useMemo(() => (subnets ? liveValidatorCounts(subnets) : null), [subnets]);
  return { live, failed: error };
}

/**
 * Chain IDs our stats API indexes, for deciding whether a chain is worth
 * offering as a destination.
 *
 * Returns null while loading and on failure — both mean "do not narrow the
 * list", so a slow or broken fetch degrades to the full menu rather than an
 * empty one.
 */
export function useIndexedChainIds(enabled = true) {
  const [ids, setIds] = useState<Set<string> | null>(null);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    fetch("/api/indexed-chains")
      .then((r) => (r.ok ? r.json() : null))
      .then((body: { indexed?: string[] | null } | null) => {
        if (cancelled || !body?.indexed) return;
        setIds(new Set(body.indexed));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [enabled]);

  return ids;
}
