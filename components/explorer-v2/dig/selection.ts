"use client";

import { useSyncExternalStore } from "react";

/* The explorer's one selection. A visual (a gas map, a block strip, a
   chart brush) publishes what the reader has picked out, as plain text
   a person or the assistant can read, plus the doors into its records.
   Anything on the page can subscribe: the tx table filters to it, the
   chat bubble sends it along with the next question. One store, so a
   selection made on one panel is the selection everywhere. */

export interface DigSelection {
  /** what kind of records were picked: "transactions", "blocks" */
  kind: string;
  /** one line a reader sees: "12 txs · 4.1M gas · 10.3% of the block" */
  title: string;
  /** the full account for the assistant, a few short lines */
  brief: string;
  /** the records' pages, first few */
  hrefs: string[];
}

let current: DigSelection | null = null;
const listeners = new Set<() => void>();

export function setSelection(sel: DigSelection | null) {
  current = sel;
  listeners.forEach((fn) => fn());
}

export function getSelection() {
  return current;
}

function subscribe(fn: () => void) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

export function useSelection(): DigSelection | null {
  return useSyncExternalStore(subscribe, getSelection, () => null);
}

/** the event the chat bubble listens for: open with this question typed */
export const ASK_EVENT = "explorer:ask";

export function askAbout(prompt: string) {
  window.dispatchEvent(new CustomEvent(ASK_EVENT, { detail: { prompt } }));
}
