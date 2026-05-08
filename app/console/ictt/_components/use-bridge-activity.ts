'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ActivityEvent } from './types';

const STORAGE_KEY = 'ictt-bridge-activity-v1';
const MAX_EVENTS = 50;

function readLocal(): ActivityEvent[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.slice(0, MAX_EVENTS) : [];
  } catch {
    return [];
  }
}

function writeLocal(events: ActivityEvent[]) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(events.slice(0, MAX_EVENTS)));
  } catch {
    /* ignore quota errors */
  }
}

/**
 * Local activity log for the bridge console. Stores the user's optimistic
 * events (deploy, register, addCollateral, send) in localStorage so the
 * activity feed shows recent work even after a page reload.
 *
 * The redesign plan also wires `/api/ictt-stats` for historic events; v1
 * uses local-only to avoid coupling the new UI to indexer aggregation
 * shape changes. Indexer-sourced events can be merged in a follow-up.
 */
export function useBridgeActivity() {
  const [events, setEvents] = useState<ActivityEvent[]>(() => readLocal());
  const persistRef = useRef(events);

  useEffect(() => {
    persistRef.current = events;
    writeLocal(events);
  }, [events]);

  const append = useCallback((event: Omit<ActivityEvent, 'id' | 'timestamp'> & { timestamp?: number }) => {
    const next: ActivityEvent = {
      ...event,
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      timestamp: event.timestamp ?? Date.now(),
    };
    setEvents((prev) => [next, ...prev].slice(0, MAX_EVENTS));
  }, []);

  const clear = useCallback(() => setEvents([]), []);

  // Counts useful for the ICM rail.
  const messageCount = useMemo(
    () => events.filter((e) => e.kind === 'register' || e.kind === 'send').length,
    [events],
  );

  return { events, append, clear, messageCount };
}
