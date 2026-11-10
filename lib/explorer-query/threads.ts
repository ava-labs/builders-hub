/* The threads a Query page holds: open in tabs, and kept in history. A
   thread is a question and the follow-ups that refined it. A tab keeps
   its thread and the answer it stands on, so a switch or a reload draws
   that answer again and asks no model; tabs belong to one browser tab
   (sessionStorage) and outlast its reloads. History keeps each thread
   this device asked on the page, newest first, across sessions
   (localStorage): its newest entries keep their rows, the older ones
   their SQL and layout, which run again with no model. A store too full
   to write is written again lighter, as boards are (board.ts). */

import { useSyncExternalStore } from "react";
import type { QueryAnswer, Turn } from "./types";
import { SNAPSHOT_ROWS } from "./board";

/** open tabs, as recent.ts keeps questions; past the cap the oldest tab closes */
export const MAX_TABS = 8;
/** history entries a page keeps */
export const MAX_ENTRIES = 50;
/** the newest history entries keep their rows; the older ones keep their SQL */
const ROWS_KEPT = 8;

/** an answer as a tab or history keeps it, with the thread that asked it */
export interface Kept {
  turns: Turn[];
  answer: QueryAnswer;
  /** rows were left out to fit the store: the SQL runs again before the answer shows */
  cut?: boolean;
}

/** an open tab */
export interface QueryTab {
  id: string;
  /** the history entry the tab writes its thread to; empty until its first answer */
  entry: string;
  /** the chain the tab asks (the network's page has more than one) */
  chain: string;
  /** the first question, at work or answered; null for a tab with no question yet */
  name: string | null;
  kept: Kept | null;
}

export interface TabSet {
  tabs: QueryTab[];
  active: string;
}

/** a thread in history */
export interface HistoryEntry {
  id: string;
  chain: string;
  /** unix ms of the thread's last new turn */
  at: number;
  kept: Kept;
}

export function newId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID().replace(/-/g, "").slice(0, 12);
  return Math.random().toString(36).slice(2, 14);
}

/* ------------------------------------------------------------------ */
/* tabs                                                                */

/** the thread a kept answer stands on, as the URL writes it */
export function threadOf(k: Kept | null): string[] {
  return k ? k.turns.map((t) => t.prompt) : [];
}

export function sameThread(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((x, i) => x === b[i]);
}

/** a tab with no question */
export function blankTab(chain: string, id = newId()): QueryTab {
  return { id, entry: "", chain, name: null, kept: null };
}

/** a tab opened at the end and put in view; past the cap the oldest tab closes */
export function openTab(set: TabSet, tab: QueryTab): TabSet {
  return { tabs: [...set.tabs, tab].slice(-MAX_TABS), active: tab.id };
}

/** a tab closed: the tab beside it comes into view, and the last tab closed leaves a blank one */
export function closeTab(set: TabSet, id: string, chain: string): TabSet {
  const i = set.tabs.findIndex((t) => t.id === id);
  if (i < 0) return set;
  const tabs = set.tabs.filter((t) => t.id !== id);
  if (!tabs.length) return openTab({ tabs, active: "" }, blankTab(chain));
  return { tabs, active: set.active === id ? tabs[Math.min(i, tabs.length - 1)].id : set.active };
}

/* the tab a page lands on for the URL's thread: the tab that holds it
   (on this chain, since its SQL names one), the tab still asking it (on
   any chain: the network's page moves a question to the chain it
   names), or a blank tab for no thread. Else the blank tab in view takes
   the thread, or a new tab opens for it. The tab in view wins a tie.
   `id` names a new tab, so a render can draw the landing before it is
   written */
export function landOn(set: TabSet | null, thread: string[], chain: string, id = newId()): TabSet {
  const tabs = set?.tabs ?? [];
  const blank = (t: QueryTab) => !t.name && !t.kept;
  const fits = (t: QueryTab) =>
    thread.length ? (!!t.kept && t.chain === chain && sameThread(threadOf(t.kept), thread)) || (!t.kept && t.name === thread[0]) : blank(t);
  const hit = tabs.find((t) => t.id === set?.active && fits(t)) ?? tabs.find(fits);
  if (hit) return { tabs, active: hit.id };
  const shown = tabs.find((t) => t.id === set?.active && blank(t));
  if (shown) return { tabs: tabs.map((t) => (t === shown ? { ...t, chain, name: thread[0] } : t)), active: shown.id };
  return openTab({ tabs, active: "" }, { ...blankTab(chain, id), name: thread[0] ?? null });
}

/** an answer as the stores keep it: a layout still being drawn is kept as its basic one */
export function keep(turns: Turn[], answer: QueryAnswer): Kept {
  return { turns, answer: answer.draftVisual ? { ...answer, draftVisual: false } : answer };
}

/* what the page in a tab reports: the thread on its line, and the answer
   once one stands. A thread that starts again (a new first question, or
   after a blank page) writes a new history entry. The same tab comes
   back when nothing is new: a page drawing its kept answer again, or
   one whose rows did not load again */
export function reported(tab: QueryTab, thread: string[], turns: Turn[], answer: QueryAnswer | null, chain: string): QueryTab {
  if (!answer && tab.kept && tab.chain === chain && (!thread.length || sameThread(thread, threadOf(tab.kept)))) return tab;
  const same = !!tab.kept && tab.chain === chain && tab.kept.answer === answer && sameThread(threadOf(tab.kept), turns.map((t) => t.prompt));
  const kept = !answer ? null : same ? tab.kept : keep(turns, answer);
  const again = !tab.kept || !tab.entry || tab.kept.turns[0]?.prompt !== turns[0]?.prompt;
  const name = thread[0] ?? null;
  if ((same || (!kept && !tab.kept)) && name === tab.name && chain === tab.chain) return tab;
  return { ...tab, chain, name, kept, entry: kept && again ? newId() : tab.entry };
}

/* ------------------------------------------------------------------ */
/* history                                                             */

/** an entry written into history, newest first; a thread with no new turn keeps its place */
export function putEntry(list: HistoryEntry[], e: HistoryEntry): HistoryEntry[] {
  const old = list.find((x) => x.id === e.id);
  const at = old && sameThread(threadOf(old.kept), threadOf(e.kept)) ? old.at : e.at;
  return [...list.filter((x) => x.id !== e.id), { ...e, at }].sort((a, b) => b.at - a.at).slice(0, MAX_ENTRIES);
}

export const DAY_GROUPS = ["Today", "Yesterday", "Previous 7 days", "Older"] as const;
export type DayGroup = (typeof DAY_GROUPS)[number];

/** history by the day of each thread's last turn, in the reader's own time zone; a group with no entry is left out */
export function byDay(list: HistoryEntry[], now: number): { label: DayGroup; entries: HistoryEntry[] }[] {
  const d = new Date(now);
  // midnights by the calendar, so a day with a clock change is still one day
  const midnight = (back: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() - back).getTime();
  const starts = [midnight(0), midnight(1), midnight(7), -Infinity];
  return DAY_GROUPS.map((label, i) => ({ label, entries: list.filter((e) => e.at >= starts[i] && (i === 0 || e.at < starts[i - 1])) })).filter((g) => g.entries.length > 0);
}

/* ------------------------------------------------------------------ */
/* lighter stores                                                      */

/** a kept answer without its rows: its SQL runs again when it opens. One without SQL keeps them */
export function bare(k: Kept): Kept {
  const r = k.answer.result;
  if (!r?.rows.length || !k.answer.sql) return k;
  return { ...k, cut: true, answer: { ...k.answer, result: { ...r, rows: [] } } };
}

/** a kept answer whole while its rows are at most n, else bare */
const upTo = (n: number) => (k: Kept) => ((k.answer.result?.rows.length ?? 0) > n ? bare(k) : k);

/** the tabs, each kept answer passed through fn */
const lighterTabs = (set: TabSet, fn: (k: Kept) => Kept): TabSet => ({ ...set, tabs: set.tabs.map((t) => (t.kept ? { ...t, kept: fn(t.kept) } : t)) });

/* history's lighter stores: rows on the newest entries only, then fewer
   rows on those, then none */
export function lighterHistory(list: HistoryEntry[]): HistoryEntry[][] {
  const by = (fn: (k: Kept, i: number) => Kept) => list.map((e, i) => ({ ...e, kept: fn(e.kept, i) }));
  return [by((k, i) => (i < ROWS_KEPT ? upTo(SNAPSHOT_ROWS)(k) : bare(k))), by((k, i) => (i < ROWS_KEPT ? upTo(100)(k) : bare(k))), by(bare)];
}

/** the first of the stores that fits, lightest last; false when none does */
export function writeLight(storage: Storage, key: string, stores: (() => unknown)[]): boolean {
  for (const store of stores) {
    try {
      storage.setItem(key, JSON.stringify(store()));
      return true;
    } catch {
      /* over quota: try lighter */
    }
  }
  return false;
}

/* ------------------------------------------------------------------ */
/* the stores                                                          */

const tabsKey = (scope: string) => `explorer-query-tabs:v1:${scope}`;
const HISTORY = "explorer-query-history:v1:";
const historyKey = (scope: string) => `${HISTORY}${scope}`;
const OPEN_KEY = "explorer-query-history:open";
/* same-tab writers announce themselves; other tabs arrive as storage events */
const EVENT = "explorer-query-threads";

/* each store parsed once: a write keeps the whole value it wrote, rows
   and all, while storage holds what fits. A render never parses rows */
const memo = new Map<string, unknown>();

function read<T>(storage: () => Storage, key: string): T | null {
  if (memo.has(key)) return memo.get(key) as T | null;
  let value: T | null = null;
  try {
    const raw = storage().getItem(key);
    value = raw ? (JSON.parse(raw) as T) : null;
  } catch {
    /* private mode, or the server: nothing is kept */
  }
  memo.set(key, value);
  return value;
}

function write(storage: () => Storage, key: string, value: unknown, stores: (() => unknown)[]): void {
  memo.set(key, value);
  try {
    writeLight(storage(), key, stores);
  } catch {
    /* private mode: this page still holds it */
  }
  window.dispatchEvent(new Event(EVENT));
}

function subscribe(fn: () => void): () => void {
  const onStorage = (e: StorageEvent) => {
    if (e.key !== null && !e.key.startsWith(HISTORY) && e.key !== OPEN_KEY) return;
    if (e.key) memo.delete(e.key);
    else memo.clear();
    fn();
  };
  window.addEventListener("storage", onStorage);
  window.addEventListener(EVENT, fn);
  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener(EVENT, fn);
  };
}

const session = () => sessionStorage;
const device = () => localStorage;

export function readTabs(scope: string): TabSet | null {
  return read<TabSet>(session, tabsKey(scope));
}

export function writeTabs(scope: string, set: TabSet): void {
  write(session, tabsKey(scope), set, [() => set, () => lighterTabs(set, upTo(SNAPSHOT_ROWS)), () => lighterTabs(set, bare)]);
}

/** a page's tabs, live; null on the server and before the page first lands */
export function useTabs(scope: string): TabSet | null {
  return useSyncExternalStore(
    subscribe,
    () => readTabs(scope),
    () => null,
  );
}

const NONE: HistoryEntry[] = [];

export function readHistory(scope: string): HistoryEntry[] {
  return read<HistoryEntry[]>(device, historyKey(scope)) ?? NONE;
}

function writeHistory(scope: string, list: HistoryEntry[]): void {
  write(device, historyKey(scope), list, lighterHistory(list).map((l) => () => l));
}

export function keepEntry(scope: string, e: HistoryEntry): void {
  writeHistory(scope, putEntry(readHistory(scope), e));
}

export function deleteEntry(scope: string, id: string): void {
  writeHistory(scope, readHistory(scope).filter((e) => e.id !== id));
}

/** a page's history, newest first, live across browser tabs; empty on the server */
export function useHistory(scope: string): HistoryEntry[] {
  return useSyncExternalStore(
    subscribe,
    () => readHistory(scope),
    () => NONE,
  );
}

/** whether the history column stands open on a wide screen; open until the reader closes it */
export function useHistoryOpen(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => read<boolean>(device, OPEN_KEY) ?? true,
    () => true,
  );
}

export function setHistoryOpen(open: boolean): void {
  write(device, OPEN_KEY, open, [() => open]);
}
