"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";

/* The ticker: a feed lands in batches (a poll's blocks, a block's txs), and
   the list should read as a steady tape. Newcomers queue up and are
   released one at a time at the feed's own rate, so a batch of three a
   second shows one every third of a second, not three at once and then
   nothing. The list is a strict sequence: a row goes in at the top, only
   ever newer than the row before it, so nothing on screen moves except to
   make room. A newcomer older than the top row (a hole filled late) is let
   go rather than slotted in, and a newcomer with a row's own key (the same
   tx, read again with more on it) takes that row's place without moving
   it. The first batch paints whole, and while the window is short a
   newcomer older than its last row fills in beneath it: a board fed by two
   sources (the indexer's page and the stream's first blocks) opens full
   whichever lands first.

   A feed that polls on a clock (`every`) gets a pace from the clock
   instead: each batch spreads evenly until a little after the next poll is
   due, so the tape runs out about as the next batch lands and never stands
   still between polls. A board merged from feeds that lag by different
   amounts (`lag`) keeps a newcomer older than the top row, so the slowest
   feed's rows are not let go: the queue holds its rows oldest first and
   each goes in at its place by time, so the ages on the board only grow
   down the list. Only a newcomer older than the top row by more than the
   feeds' lag, or one that would land under a full window, is let go. */

/* the release pace stays between these */
const MIN_MS = 150;
const MAX_MS = 700;
/* a fresh batch waits this long before its first row, so names can warm */
const WARM_MS = 180;
/* a clocked feed's queue runs out this share of an interval after the next
   poll is due, so a poll that lands a little late finds the tape still moving */
const SLACK = 0.1;

/** How far apart a merged board's feeds run: a newcomer up to `ms` older
 *  than the top row still shows. `at` is a row's time, epoch ms. */
export interface Lag<T> {
  ms: number;
  at: (t: T) => number;
}

/** Where a batch of newcomers goes. An empty window paints them whole.
 *  Otherwise a newcomer newer than the top row and than every row waiting
 *  joins the queue (oldest first), one older than the last row fills in
 *  beneath it while the window is short, and one in between is let go.
 *  With `lag`, a newcomer that does not fill in beneath joins the queue at
 *  its place by time (oldest first), unless it is older than the top row by
 *  more than the lag or would land under a full window. */
export function admit<T>(
  visible: readonly T[],
  queue: readonly T[],
  fresh: readonly T[],
  visibleMax: number,
  newer: (a: T, b: T) => number,
  lag?: Lag<T>,
): { visible: T[]; queue: T[] } {
  const sorted = [...fresh].sort(newer);
  if (!visible.length) return { visible: sorted.slice(0, visibleMax), queue: [...queue] };
  const top = visible[0];
  const last = visible[visible.length - 1];
  const room = visibleMax - visible.length;
  const below = room > 0 ? sorted.filter((t) => newer(t, last) > 0).slice(0, room) : [];
  const shown = below.length ? [...visible, ...below] : [...visible];
  if (lag) {
    const oldest = lag.at(top) - lag.ms;
    const floor = shown.length >= visibleMax ? shown[shown.length - 1] : undefined;
    const join = sorted.filter(
      (t) => !below.includes(t) && lag.at(t) >= oldest && (floor === undefined || newer(t, floor) < 0),
    );
    return { visible: shown, queue: [...queue, ...join].sort((a, b) => newer(b, a)) };
  }
  const tail = queue[queue.length - 1];
  const next = [...queue];
  for (const t of [...sorted].reverse()) {
    if (newer(t, top) >= 0) continue;
    if (tail !== undefined && newer(t, tail) >= 0) continue;
    next.push(t);
  }
  return { visible: shown, queue: next };
}

/** A row's place by time on a board, newest first: null when it would land
 *  under a full window */
export function place<T>(visible: readonly T[], row: T, visibleMax: number, newer: (a: T, b: T) => number): T[] | null {
  const i = visible.findIndex((v) => newer(row, v) < 0);
  const at = i < 0 ? visible.length : i;
  if (at >= visibleMax) return null;
  return [...visible.slice(0, at), row, ...visible.slice(at, visibleMax - 1)];
}

/** The next row out of the queue (oldest first): the board and the queue
 *  after it. Far behind, the queue skips to its newest window rather than
 *  replay history. A row goes in at the top; with `lag`, at its place by
 *  time, and one that would land under the window (the window moved on
 *  while it waited) is let go. `visible` is null when no row shows. */
export function releaseOne<T>(
  visible: readonly T[],
  queue: readonly T[],
  visibleMax: number,
  newer: (a: T, b: T) => number,
  lag?: Lag<T>,
): { visible: T[] | null; queue: T[] } {
  const q = queue.length > visibleMax * 2 ? queue.slice(queue.length - visibleMax) : [...queue];
  let shown: T[] | null = null;
  while (!shown && q.length) {
    const next = q.shift()!;
    shown = lag ? place(visible, next, visibleMax, newer) : [next, ...visible].slice(0, visibleMax);
  }
  return { visible: shown, queue: q };
}

/** A clocked feed's pace: the wait after the last row for the next one.
 *  The rows waiting share the time from the last release until a little
 *  after the next poll is due. One row never waits more than an interval,
 *  and a backlog (rows held under the pointer) catches up at the floor. */
export function clockPace(every: number, lastBatch: number, lastRelease: number, waiting: number): number {
  const left = lastBatch + every * (1 + SLACK) - lastRelease;
  return Math.min(every, Math.max(MIN_MS, left / Math.max(1, waiting)));
}

/** `incoming` is newest first and keeps each row's object between
 *  renders while the row is unchanged: a new object is read as the row
 *  read again, and is drawn again */
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
    /** false: the feed's rows show as they come (a list that swaps whole on
     *  each poll); the ticker still keeps count of them, so turning it on
     *  carries on from the rows on screen */
    enabled?: boolean;
    /** the feed's poll interval in ms: each batch spreads over it (see clockPace) */
    every?: number;
    /** the rows come from feeds that run this far apart: each goes in at its
     *  place by time (see admit and releaseOne) */
    lag?: Lag<T>;
  },
): T[] {
  const { key, newer, paused = false, onEnqueue, enabled = true, every, lag } = opts;
  const [visible, setVisible] = useState<T[]>([]);
  const visibleRef = useRef<T[]>([]);
  // oldest first: the next to release is at the front
  const queue = useRef<T[]>([]);
  const seen = useRef(new Set<string>());
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
    if (every) return clockPace(every, lastArrive.current, lastRelease.current, queue.current.length);
    const r = Math.max(rate.current, 0.001);
    let p = 1000 / r;
    // a backlog past a couple of seconds' worth tightens the pace
    if (queue.current.length > 2 * r + 2) p *= 0.6;
    return Math.min(MAX_MS, Math.max(MIN_MS, p));
  };

  const release = () => {
    timer.current = null;
    if (pausedRef.current) return;
    const out = releaseOne(visibleRef.current, queue.current, visibleMax, newerRef.current, lag);
    queue.current = out.queue;
    if (!out.visible) return;
    lastRelease.current = Date.now();
    visibleRef.current = out.visible;
    setVisible(out.visible);
    arm(false);
  };

  const arm = (fresh: boolean) => {
    if (timer.current || pausedRef.current || !queue.current.length) return;
    const wait = Math.max(0, lastRelease.current + pace() - Date.now(), fresh ? WARM_MS : 0);
    timer.current = setTimeout(release, wait);
  };

  const remember = (rows: T[]) => {
    const k = keyRef.current;
    for (const t of rows) seen.current.add(k(t));
    if (seen.current.size > 2000) seen.current = new Set([...seen.current].slice(-1000));
  };

  // before paint: rows that are there when the list mounts (a page opened
  // from memory) show in its first frame, not one frame after a skeleton
  useLayoutEffect(() => {
    const k = keyRef.current;
    if (!enabled) {
      // the rows on screen are the feed's own; counted, so the ticker can take over from them
      remember(incoming);
      queue.current = [];
      const shown = incoming.slice(0, visibleMax);
      const same = shown.length === visibleRef.current.length && shown.every((t, i) => k(t) === k(visibleRef.current[i]));
      if (same) return;
      visibleRef.current = shown;
      setVisible(shown);
      if (shown.length) lastRelease.current = lastArrive.current = Date.now();
      return;
    }
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
    remember(fresh);
    onEnqueueRef.current?.(fresh);
    const now = Date.now();
    const opening = !visibleRef.current.length;
    const placed = admit(visibleRef.current, queue.current, fresh, visibleMax, newerRef.current, lag);
    queue.current = placed.queue;
    if (placed.visible.length !== visibleRef.current.length) {
      visibleRef.current = placed.visible;
      setVisible(placed.visible);
    }
    if (opening) {
      lastRelease.current = now;
      lastArrive.current = now;
      return;
    }
    // the rate: this batch over the time since the last, smoothed
    const dt = Math.max(250, now - lastArrive.current) / 1000;
    lastArrive.current = now;
    const inst = fresh.length / dt;
    rate.current = rate.current ? 0.35 * inst + 0.65 * rate.current : inst;
    // a clocked feed's batch changes the pace of the rows still waiting: plan the next release again
    if (every && timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
    arm(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [incoming, visibleMax, enabled]);

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

  return enabled ? visible : incoming.slice(0, visibleMax);
}
