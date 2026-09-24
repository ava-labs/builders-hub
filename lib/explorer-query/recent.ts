/* The questions asked on this device, newest first, per chain. They come
   back on the Query page and in the search bar, so a question someone
   asks every morning is one click the next day. */

import { useSyncExternalStore } from "react";

const KEY = "explorer-query-recent";
const MAX = 8;
/* same-tab writers announce themselves; other tabs arrive as storage events */
const EVENT = "explorer-query-recent";

type Store = Record<string, string[]>;

function read(): Store {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "{}") as Store;
  } catch {
    return {};
  }
}

function announce() {
  window.dispatchEvent(new Event(EVENT));
}

export function recentQuestions(chain: string): string[] {
  if (typeof window === "undefined") return [];
  return read()[chain] ?? [];
}

export function rememberQuestion(chain: string, q: string): void {
  try {
    const all = read();
    const norm = q.trim();
    const list = [norm, ...(all[chain] ?? []).filter((x) => x.toLowerCase() !== norm.toLowerCase())].slice(0, MAX);
    localStorage.setItem(KEY, JSON.stringify({ ...all, [chain]: list }));
    announce();
  } catch {
    /* private mode: nothing is kept */
  }
}

/** drop one question from a chain's list */
export function forgetQuestion(chain: string, q: string): void {
  try {
    const all = read();
    const norm = q.trim().toLowerCase();
    all[chain] = (all[chain] ?? []).filter((x) => x.toLowerCase() !== norm);
    localStorage.setItem(KEY, JSON.stringify(all));
    announce();
  } catch {
    /* nothing to forget */
  }
}

export function forgetQuestions(chain: string): void {
  try {
    const all = read();
    delete all[chain];
    localStorage.setItem(KEY, JSON.stringify(all));
    announce();
  } catch {
    /* nothing to forget */
  }
}

function subscribe(fn: () => void): () => void {
  const onStorage = (e: StorageEvent) => {
    if (e.key === KEY || e.key === null) fn();
  };
  window.addEventListener("storage", onStorage);
  window.addEventListener(EVENT, fn);
  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener(EVENT, fn);
  };
}

const EMPTY: string[] = [];
// keyed by the raw string, so an unchanged store hands back the same array
const cache = new Map<string, { raw: string | null; list: string[] }>();
function snapshot(chain: string): string[] {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(KEY);
  } catch {
    return EMPTY;
  }
  const hit = cache.get(chain);
  if (hit && hit.raw === raw) return hit.list;
  const list = recentQuestions(chain);
  const out = list.length ? list : EMPTY;
  cache.set(chain, { raw, list: out });
  return out;
}

/** a chain's recent questions, live across this tab and every other */
export function useRecentQuestions(chain: string): string[] {
  return useSyncExternalStore(
    subscribe,
    () => snapshot(chain),
    () => EMPTY,
  );
}
