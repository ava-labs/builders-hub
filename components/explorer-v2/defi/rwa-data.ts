"use client";

import { useEffect, useState } from "react";
import { fenceBounds, type DayWindow } from "@/lib/rwa/series";
import type { FenceHistoricalData } from "@/lib/rwa/types";

/* Fence's collections for the page clock's window. Each window is its own
   read, so the answer carries the window it answers: a switch keeps the
   last answer on screen, marked stale, until the new one lands, and an
   answer to a window the clock already left is dropped (useFlows' rule). */

export interface Keyed<T> {
  key: string;
  data: T;
}

/** what the chart shows for the window `key`: its answer, else the last answer, stale */
export function shownAnswer<T>(key: string, answer: Keyed<T> | null): { data: T | null; stale: boolean } {
  return { data: answer?.data ?? null, stale: !!answer && answer.key !== key };
}

export function useFenceCollections(slug: string, w: DayWindow | null) {
  const bounds = w ? fenceBounds(w) : null;
  const key = bounds ? `${bounds.startDate}/${bounds.endDate}` : "all";
  const [answer, setAnswer] = useState<Keyed<FenceHistoricalData> | null>(null);
  const [failedKey, setFailedKey] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const query = bounds ? `?${new URLSearchParams(bounds)}` : "";
    // one read: the route already answers an outage with its stale copy or a 503
    fetch(`/api/dapps/rwa/${slug}/fence/historical${query}`)
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(`HTTP ${res.status}`))))
      .then((data: FenceHistoricalData) => {
        if (cancelled) return;
        setAnswer({ key, data });
        setFailedKey(null);
      })
      .catch(() => {
        if (!cancelled) setFailedKey(key);
      });
    return () => {
      cancelled = true;
    };
    // key spells out the bounds, so it stands in for them
  }, [slug, key]);

  return { ...shownAnswer(key, answer), failed: failedKey === key };
}
