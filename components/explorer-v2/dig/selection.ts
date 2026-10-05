"use client";

/* The explorer's one selection. A visual (a gas map, a block strip, a
   chart brush) publishes what the reader has picked out, as plain text
   a person or the assistant can read, plus the doors into its records.
   The chat bubble reads it and sends it along with the next question.
   One store, so a selection made on one panel is the selection
   everywhere. */

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

export function setSelection(sel: DigSelection | null) {
  current = sel;
}

export function getSelection() {
  return current;
}

/** the event the chat bubble listens for: open with this question typed */
export const ASK_EVENT = "explorer:ask";

export function askAbout(prompt: string) {
  window.dispatchEvent(new CustomEvent(ASK_EVENT, { detail: { prompt } }));
}
