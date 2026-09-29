"use client";

import { useEffect, useRef, useState } from "react";

/* The ticker: a feed lands in batches (a poll's blocks, a block's txs), and
   the list should read as a steady tape. Newcomers queue up and are
   released one at a time at the feed's own rate, so a batch of three a
   second shows one every third of a second, not three at once and then
   nothing. The list is a strict sequence: a row goes in at the top, only
   ever newer than the row before it, so nothing on screen moves except to
   make room. A newcomer older than the top row (a hole filled late) is let
   go rather than slotted in, and a newcomer with a row's own key (the same
   tx, read again with more on it) takes that row's place without moving
   it. The first batch paints whole. */

/* the release pace stays between these */
const MIN_MS = 150;
const MAX_MS = 700;
/* a fresh batch waits this long before its first row, so names can warm */
const WARM_MS = 180;

export function useTicker<T>(
  incoming: T[],
  visibleMax: number,
  opts: {
    key: (t: T) => string;
    /** negative when `a` is newer than `b` */
    newer: (a: T, b: T) => number;
    /** hold the tape still (the pointer is over it); newcomers queue and catch up once released */
    paused?: boolean;
    /** the newcomers of a batch, before any shows: the caller warms their names */
    onEnqueue?: (fresh: T[]) => void;
  },
): T[] {
  const { key, newer, paused = false, onEnqueue } = opts;
  const [visible, setVisible] = useState<T[]>([]);
  const visibleRef = useRef<T[]>([]);
  // oldest first: the next to release is at the front
  const queue = useRef<T[]>([]);
  const seen = useRef(new Set<string>());
  const painted = useRef(false);
  const pausedRef = useRef(paused);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastRelease = useRef(0);
  const lastArrive = useRef(0);
  // the feed's rate, items a second, smoothed over the last batches
  const rate = useRef(0);
  const onEnqueueRef = useRef(onEnqueue);
  onEnqueueRef.current = onEnqueue;
  const newerRef = useRef(newer);
  newerRef.current = newer;
  const keyRef = useRef(key);
  keyRef.current = key;

  const pace = () => {
    const r = Math.max(rate.current, 0.001);
    let p = 1000 / r;
    // a backlog past a couple of seconds' worth tightens the pace
    if (queue.current.length > 2 * r + 2) p *= 0.6;
    return Math.min(MAX_MS, Math.max(MIN_MS, p));
  };

  const release = () => {
    timer.current = null;
    if (pausedRef.current) return;
    const q = queue.current;
    // far behind: skip to the newest window rather than replay history
    if (q.length > visibleMax * 2) q.splice(0, q.length - visibleMax);
    const next = q.shift();
    if (next === undefined) return;
    lastRelease.current = Date.now();
    visibleRef.current = [next, ...visibleRef.current].slice(0, visibleMax);
    setVisible(visibleRef.current);
    arm(false);
  };

  const arm = (fresh: boolean) => {
    if (timer.current || pausedRef.current || !queue.current.length) return;
    const wait = Math.max(0, lastRelease.current + pace() - Date.now(), fresh ? WARM_MS : 0);
    timer.current = setTimeout(release, wait);
  };

  useEffect(() => {
    const k = keyRef.current;
    // a row read again (the same key, another object) is refreshed where it stands
    const byKey = new Map(incoming.map((t) => [k(t), t]));
    let changed = false;
    const refreshed = visibleRef.current.map((v) => {
      const n = byKey.get(k(v));
      if (n === undefined || n === v) return v;
      changed = true;
      return n;
    });
    if (changed) {
      visibleRef.current = refreshed;
      setVisible(refreshed);
    }
    queue.current = queue.current.map((q) => byKey.get(k(q)) ?? q);
    const fresh = incoming.filter((t) => !seen.current.has(k(t)));
    if (!fresh.length) return;
    for (const t of fresh) seen.current.add(k(t));
    if (seen.current.size > 2000) seen.current = new Set([...seen.current].slice(-1000));
    onEnqueueRef.current?.(fresh);
    const now = Date.now();
    const sorted = [...fresh].sort(newerRef.current);
    if (!painted.current) {
      painted.current = true;
      lastRelease.current = now;
      lastArrive.current = now;
      visibleRef.current = sorted.slice(0, visibleMax);
      setVisible(visibleRef.current);
      return;
    }
    // the rate: this batch over the time since the last, smoothed
    const dt = Math.max(250, now - lastArrive.current) / 1000;
    lastArrive.current = now;
    const inst = fresh.length / dt;
    rate.current = rate.current ? 0.35 * inst + 0.65 * rate.current : inst;
    // only newer than the top row joins the queue; the queue stays oldest first
    const top = visibleRef.current[0];
    const q = queue.current;
    const tail = q[q.length - 1];
    for (const t of sorted.reverse()) {
      if (top !== undefined && newerRef.current(t, top) >= 0) continue;
      if (tail !== undefined && newerRef.current(t, tail) >= 0) continue;
      q.push(t);
    }
    arm(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [incoming, visibleMax]);

  useEffect(() => {
    pausedRef.current = paused;
    if (!paused) arm(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paused]);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  return visible;
}
