/* The page's side of the query route (app/api/explorer/query): a question
   streamed as NDJSON events, the route's plain calls, and the words a page
   shows while it waits and when it reads the answer out. Shared by the
   Query page and the city's answer window, so both speak to the route and
   to the reader the same way. */

import { formatNumber, truncate } from "@/components/explorer-v2/format";
import type { QueryEvent } from "@/lib/explorer-query/answer";
import type { QueryAnswer } from "@/lib/explorer-query/types";

/** a failed ask; signIn marks the anonymous limit, which sign-in lifts */
export class QueryError extends Error {
  constructor(
    message: string,
    readonly signIn = false,
  ) {
    super(message);
  }
}

/** one plain call: a drill, a layout, a reading, a hand-edited SQL */
export async function postQuery<T>(body: object): Promise<T> {
  const res = await fetch("/api/explorer/query", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const out = (await res.json()) as T & { error?: string };
  if (!res.ok || out.error) throw new Error(out.error ?? `HTTP ${res.status}`);
  return out;
}

/** a question, streamed: each step as it ends, then the answer */
export async function streamQuery(body: object, onEvent: (e: QueryEvent) => void): Promise<QueryAnswer> {
  const res = await fetch("/api/explorer/query", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  if (!res.ok || !res.body) {
    const out = (await res.json().catch(() => ({}))) as { error?: string; signIn?: boolean };
    throw new QueryError(out.error ?? `HTTP ${res.status}`, !!out.signIn);
  }
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (value) buf += dec.decode(value, { stream: true });
    let nl: number;
    while ((nl = buf.indexOf("\n")) >= 0) {
      const line = buf.slice(0, nl).trim();
      buf = buf.slice(nl + 1);
      if (!line) continue;
      const e = JSON.parse(line) as QueryEvent;
      if (e.type === "answer") return e.answer;
      if (e.type === "error") throw new Error(e.error);
      onEvent(e);
    }
    if (done) throw new Error("The answer stopped before it finished.");
  }
}

/* the loader's line: the phase a reader would name, never which model
   does it and never the engine's own words for its steps. An event ends a
   step, so the line names the phase that step leaves the question in */
export function progress(events: QueryEvent[]): string {
  let line = "Writing the SQL";
  let fixes = 0;
  for (const e of events) {
    if (e.type === "stage") {
      // a kept answer runs its SQL; one that no longer runs is written again
      fixes = 0;
      line = e.stage === "cached" ? "Running the query" : e.stage === "escalated" ? "Writing the SQL again" : "Writing the SQL";
    } else if (e.type === "step") {
      if (!e.ok) {
        fixes += 1;
        line = fixes === 1 ? "Fixing the SQL" : `Fixing the SQL, ${ordinal(fixes)} try`;
        continue;
      }
      const n = /^(\d+) rows?$/.exec(e.detail);
      const rows = n ? Number(n[1]) : null;
      if (e.kind === "test") line = rows === null ? "Trying the SQL on a sample" : `Trying the SQL on a sample: ${rowCount(rows)}`;
      else if (e.detail === "no chart") line = "Writing the answer";
      else line = rows ? `Reading ${rowCount(rows)}` : "Reading the rows";
    }
  }
  return line;
}

/** "1 row", "1,204 rows" */
export const rowCount = (n: number) => `${formatNumber(n)} ${n === 1 ? "row" : "rows"}`;

const ordinal = (n: number) => `${n}${n % 10 === 2 && n % 100 !== 12 ? "nd" : n % 10 === 3 && n % 100 !== 13 ? "rd" : n % 10 === 1 && n % 100 !== 11 ? "st" : "th"}`;

/** the callouts as one paragraph: every sentence closed, no 1.395e+6, short addresses */
export function reads(callouts: string[]): string {
  return callouts
    .map((c) =>
      c
        .trim()
        .replace(/\b\d+(?:\.\d+)?e[+-]?\d+\b/gi, (m) => formatNumber(Number(m)))
        // an address reads the way the charts write it
        .replace(/\b0x[0-9a-fA-F]{40}\b/g, (m) => truncate(m.toLowerCase(), 6)),
    )
    .filter(Boolean)
    .map((c) => (/[.!?]$/.test(c) ? c : `${c}.`))
    .join(" ");
}

/* the selection rides along with a follow-up after this mark, so the
   question the reader sees stays the one they typed; the city's window
   scopes a P-Chain question to a picked L1 the same way */
export const FILTER_MARK = "\n\n(Only the rows where ";

/** under every answer: the figures rest on SQL a model wrote */
export const SQL_CAVEAT = "The SQL behind this answer is written by an AI model and may not be 100% accurate. Check it before you rely on a figure.";
