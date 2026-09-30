"use client";

import { useCallback, useEffect, useState } from "react";

/* The explorer's memory of what it read. Each payload is kept by its URL
   for the session, so a page opened again (a tab left and come back to,
   the back button, a link hovered before its click) paints from memory at
   once and reads again behind it. A polled list shows from memory only
   while it is young: older rows would open the page on the past. A record
   (a tx, a block, an address) shows for longer. */

const MEMORY_MAX = 80;
const LIVE_SHOW_MS = 30_000;
const RECORD_SHOW_MS = 10 * 60_000;
/* a payload this young (a hover's read a moment ago) is not asked for again when its page opens */
const FRESH_MS = 3_000;

const memory = new Map<string, { data: unknown; at: number }>();
const reading = new Map<string, Promise<unknown>>();

/** keep `data` as the last payload read from `url` */
export function remember(url: string, data: unknown): void {
  memory.delete(url);
  memory.set(url, { data, at: Date.now() });
  // least recent first: past the cap, the oldest go
  for (const k of memory.keys()) {
    if (memory.size <= MEMORY_MAX) break;
    memory.delete(k);
  }
}

/** the payload last read from `url`, while it is young enough to show */
export function recall<T>(url: string, live: boolean): { data: T; at: number } | null {
  if (!url || typeof window === "undefined") return null;
  const hit = memory.get(url);
  if (!hit || Date.now() - hit.at > (live ? LIVE_SHOW_MS : RECORD_SHOW_MS)) return null;
  return hit as { data: T; at: number };
}

/** read `url` into memory ahead of its page: the page then opens on it.
 *  A payload read a moment ago, or a read in flight, is not asked again. */
export function prefetchJson(url: string): void {
  const hit = memory.get(url);
  if ((hit && Date.now() - hit.at < FRESH_MS) || reading.has(url)) return;
  const read = fetch(url, { signal: AbortSignal.timeout(10_000) })
    .then((r) => (r.ok ? r.json() : null))
    .then((d: unknown) => {
      if (d != null) remember(url, d);
      return d;
    })
    .catch(() => null)
    .finally(() => reading.delete(url));
  reading.set(url, read);
}

/**
 * The explorer's one client read of a same-origin JSON route: plain fetch +
 * AbortController, silent background refresh (stale data stands on
 * failure), polling paused while the tab is hidden, and a 404 retry window
 * for entities the indexer trails on. It opens on the memory's payload
 * when there is one. useEvmData and usePchainData are this hook with their
 * own route's URL.
 */
export function usePolledJson<T>(
  /** "" reads nothing */
  key: string,
  opts?: {
    refreshMs?: number;
    /** keep re-checking a 404 for this long: fresh txs/blocks exist
     *  on-chain seconds before the indexer has ingested them */
    retry404Ms?: number;
  },
): { data: T | null; loading: boolean; error: string | null; retry: () => void } {
  const refreshMs = opts?.refreshMs ?? 0;
  const retry404Ms = opts?.retry404Ms ?? 0;
  const [opening] = useState(() => recall<T>(key, refreshMs > 0));
  const [data, setData] = useState<T | null>(opening?.data ?? null);
  const [loading, setLoading] = useState(!opening);
  const [error, setError] = useState<string | null>(null);
  // bumping the nonce re-runs the whole fetch effect: the "Retry" button
  // for feeds that died on an upstream outage rather than a 404
  const [nonce, setNonce] = useState(0);
  const retry = useCallback(() => setNonce((n) => n + 1), []);

  useEffect(() => {
    if (!key) {
      setLoading(false);
      return;
    }
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    // the memory's payload shows at once; the read behind it replaces it
    const hit = recall<T>(key, refreshMs > 0);
    if (hit) setData(hit.data);
    setLoading(!hit);
    setError(null);
    const got = (d: T) => {
      remember(key, d);
      setData(d);
      setError(null);
    };

    // Every request carries a deadline: a fetch that never settles (laptop
    // sleep mid-request, a proxy socket that never closes) would otherwise
    // end the poll chain silently: the list freezes and visibly ages while
    // the rest of the page keeps re-rendering.
    const pollSignal = () => AbortSignal.any([controller.signal, AbortSignal.timeout(15_000)]);

    // silent background refresh: stale data stands on any failure, and the
    // tab pauses polling while hidden so a parked explorer doesn't hammer
    // the (shared, small) upstream API.
    let inFlight = false;
    const refresh = async () => {
      if (inFlight) return;
      inFlight = true;
      try {
        const res = await fetch(key, { signal: pollSignal() });
        if (res.ok) got((await res.json()) as T);
      } catch {
        /* keep showing the last good payload */
      }
      inFlight = false;
      if (!controller.signal.aborted && refreshMs > 0) schedule();
    };
    let live = false;
    const schedule = () => {
      live = true;
      timer = setTimeout(() => {
        if (document.visibilityState === "hidden") schedule();
        else void refresh();
      }, refreshMs);
    };
    // hidden-tab timers are heavily throttled: on return, poll NOW rather
    // than leaving minutes-old rows on screen until the next tick lands
    const onVisible = () => {
      if (document.visibilityState === "visible" && live && !controller.signal.aborted) {
        if (timer) clearTimeout(timer);
        void refresh();
      }
    };
    document.addEventListener("visibilitychange", onVisible);

    // a 404 with retry404Ms is usually the indexer trailing the chain by
    // seconds on a fresh tx: keep re-asking until the window closes. The
    // "not found" error stays set while retrying (the page can show an
    // "indexing" state); a hit clears it and hands over to normal polling.
    const retry404Until = (deadline: number) => {
      timer = setTimeout(async () => {
        if (controller.signal.aborted) return;
        try {
          const res = await fetch(key, { signal: pollSignal() });
          if (res.ok) {
            got((await res.json()) as T);
            if (refreshMs > 0) schedule();
            return;
          }
        } catch {
          /* fall through to the next attempt */
        }
        if (!controller.signal.aborted && Date.now() < deadline) retry404Until(deadline);
      }, 4000);
    };

    (async () => {
      // a payload read a moment ago (a hovered link) or a read of it in
      // flight stands in for the first read
      const early = hit && Date.now() - hit.at < FRESH_MS ? hit.data : ((await reading.get(key)) as T | null | undefined);
      if (controller.signal.aborted) return;
      if (early != null) {
        setData(early);
        setLoading(false);
        if (refreshMs > 0) schedule();
        return;
      }
      // the upstream explorer API times out intermittently under load
      // (504 through the proxy); one spaced retry absorbs almost all of it.
      let notFound = false;
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          const res = await fetch(key, { signal: pollSignal() });
          if (res.status === 404) throw new Error("not found");
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          got((await res.json()) as T);
          break;
        } catch (e) {
          if (e instanceof DOMException && e.name === "AbortError") return;
          const message = e instanceof Error ? e.message : "failed to load";
          const retryable = message !== "not found" && attempt < 2;
          if (retryable) {
            await new Promise((r) => setTimeout(r, 1200 * (attempt + 1)));
            if (controller.signal.aborted) return;
            continue;
          }
          // with the memory's payload on screen, a failed read is a failed refresh
          if (hit) break;
          notFound = message === "not found";
          setError(message);
          setData(null);
        }
      }
      if (controller.signal.aborted) return;
      setLoading(false);
      if (notFound && retry404Ms > 0) retry404Until(Date.now() + retry404Ms);
      else if (refreshMs > 0) schedule();
    })();

    return () => {
      controller.abort();
      document.removeEventListener("visibilitychange", onVisible);
      if (timer) clearTimeout(timer);
    };
  }, [key, refreshMs, retry404Ms, nonce]);

  return { data, loading, error, retry };
}

/** One read of `url` through the memory, for a figure or a chart: the
 *  memory's payload shows at once and the read replaces it. Unlike the
 *  poll hook it never shows another URL's payload: a new URL starts from
 *  its own memory, or from nothing. A failed read leaves what is shown. */
export function useRememberedJson<T>(url: string | null): T | null {
  const [read, setRead] = useState<{ url: string | null; data: T | null }>(() => ({
    url,
    data: url ? (recall<T>(url, false)?.data ?? null) : null,
  }));
  useEffect(() => {
    if (!url) return;
    let cancelled = false;
    const hit = recall<T>(url, false);
    setRead({ url, data: hit?.data ?? null });
    if (hit && Date.now() - hit.at < FRESH_MS) return;
    // a hover's read in flight stands in for this one
    const pending = reading.get(url) ?? fetch(url).then((r) => (r.ok ? r.json() : null));
    pending
      .then((d) => {
        if (d == null) return;
        remember(url, d);
        if (!cancelled) setRead({ url, data: d as T });
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [url]);
  if (read.url === url) return read.data;
  return url ? (recall<T>(url, false)?.data ?? null) : null;
}
