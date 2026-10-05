/* The page's side of the query route (app/api/explorer/query): a question
   streamed as NDJSON events, the route's plain calls, and the words a page
   shows while it waits and when it reads the answer out. Shared by the
   Query page and the city's answer window, so both speak to the route and
   to the reader the same way. */

import posthog from "posthog-js";
import { formatNumber, truncate } from "@/components/explorer-v2/format";
import type { QueryEvent } from "@/lib/explorer-query/answer";
import type { QueryAnswer } from "@/lib/explorer-query/types";
import type { VisualSpec } from "@/lib/explorer-query/visual";
import { edgesOf, msOf, STALE_MS, windowOf } from "@/lib/explorer-query/edges";

/** a failed ask; signIn marks the anonymous limit, which sign-in lifts */
export class QueryError extends Error {
  constructor(
    message: string,
    readonly signIn = false,
  ) {
    super(message);
  }
}

/** the page's PostHog ids, so the route's events for a question join this visit; none when PostHog is off or blocked */
function tracked(): Record<string, string> {
  if (!posthog.__loaded) return {};
  return { "x-posthog-distinct-id": posthog.get_distinct_id(), "x-posthog-session-id": posthog.get_session_id() };
}

/** one plain call: a drill, a layout, a reading, a hand-edited SQL */
export async function postQuery<T>(body: object): Promise<T> {
  const res = await fetch("/api/explorer/query", { method: "POST", headers: { "content-type": "application/json", ...tracked() }, body: JSON.stringify(body) });
  const out = (await res.json()) as T & { error?: string };
  if (!res.ok || out.error) throw new Error(out.error ?? `HTTP ${res.status}`);
  return out;
}

/** a question, streamed: each step as it ends, then the answer */
export async function streamQuery(body: object, onEvent: (e: QueryEvent) => void): Promise<QueryAnswer> {
  const res = await fetch("/api/explorer/query", { method: "POST", headers: { "content-type": "application/json", ...tracked() }, body: JSON.stringify(body) });
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
        // an answer in the SQL's own words is written again; the SQL itself stands
        if (e.detail.startsWith("reader words")) {
          line = "Rewording the answer";
          continue;
        }
        fixes += 1;
        line = fixes === 1 ? "Fixing the SQL" : `Fixing the SQL, ${ordinal(fixes)} try`;
        continue;
      }
      const n = /^(\d+) rows?$/.exec(e.detail);
      const rows = n ? Number(n[1]) : null;
      if (e.kind === "test") line = rows === null ? "Trying the SQL on a sample" : `Trying the SQL on a sample: ${rowCount(rows)}`;
      else if (e.detail === "no chart") line = "Writing the answer";
      else line = rows ? `Reading ${rowCount(rows)}${rows >= ROW_CAP ? ", the most one answer holds" : ""}` : "Reading the rows";
    }
  }
  return line;
}

/** "1 row", "1,204 rows" */
export const rowCount = (n: number) => `${formatNumber(n)} ${n === 1 ? "row" : "rows"}`;

/** what the rows shown are of the whole answer, when a LIMIT or the row cap cut it: "100 of 142 rows" */
export function cutLine(a: Pick<QueryAnswer, "result" | "totals">): string | null {
  if (!a.result) return null;
  const n = a.result.rowCount;
  // read totals decide it: rows that only reach their LIMIT leave nothing out
  if (a.totals) return a.totals.rows > n ? `${a.totals.newest ? "The newest " : ""}${formatNumber(n)} of ${rowCount(a.totals.rows)}` : null;
  return a.result.truncated ? `The first ${rowCount(n)}; the query has more` : null;
}

/** an answer that ran no query; its note says why */
export const NO_QUERY = "No query ran for this question.";

/** the rows one answer holds at most: MAX_ROWS in lib/explorer-query/guard.ts, which the page does not load */
export const ROW_CAP = 2000;

/** the rows sheet's count: "100 of 142" when a LIMIT or the cap cut the answer */
export function rowsLabel(a: Pick<QueryAnswer, "result" | "totals">, n: number): string {
  if (a.totals) return a.totals.rows > n ? `${formatNumber(n)} of ${formatNumber(a.totals.rows)}` : formatNumber(n);
  return a.result?.truncated ? `${formatNumber(n)}, capped` : formatNumber(n);
}

/* a failure as a reader reads it: the engine's own words (a database error, a stream cut on its way)
   go to the console, and the reader gets what to do next */
const ENGINE = /\b(Code: \d+|DB::Exception|clickhouse|stats-api|HTTP \d{3}|ECONN\w*|fetch failed|socket)\b/i;
export function readerError(message: string): string {
  if (/stopped before it finished/i.test(message)) {
    console.warn("[query]", message);
    return "The answer was cut off on its way. Try again.";
  }
  if (!ENGINE.test(message)) return message;
  console.warn("[query]", message);
  return "The database stopped before the answer was complete. Try again in a minute.";
}

/* a bar the designer marked already takes the edge's word into its own label: two labels on one bar overlap. A
   label that says so already (the audit's V11 "Today, partial", V13 "Day not over") takes nothing, and any other
   ("Peak 519k") takes the word, so a peak on a period still filling never reads as whole */
export const SAID_PARTIAL = /\b(?:partial|so far|not over|filling|in progress|incomplete|index ends)\b/i;
function marked<M extends { x: string | number; label: string }>(markers: M[], x: string, label: string): (M | { x: string; label: string })[] {
  const i = markers.findIndex((m) => String(m.x) === x);
  if (i < 0) return [...markers, { x, label }];
  return SAID_PARTIAL.test(markers[i].label) ? markers : markers.map((m, j) => (j === i ? { ...m, label: `${m.label}, ${label}` } : m));
}

/** a time series' edge buckets that the window cuts through, labeled, so a short first bar never reads as a dip */
export function withEdges(visual: VisualSpec | null, a: Pick<QueryAnswer, "sql" | "anchor" | "result"> | null): VisualSpec | null {
  const rows = a?.result?.rows;
  const win = a ? windowOf(a.sql, a.anchor) : null;
  if (!visual || !rows || !win) return visual;
  // the last bucket of an index that ended long ago fills no more: the index ends there
  const last = a?.anchor && Date.now() - msOf(a.anchor) >= STALE_MS ? "index ends" : "so far";
  let changed = false;
  const panels = visual.panels.map((p) => {
    if (!p.x || !["bar", "line", "area"].includes(p.kind)) return p;
    const xs = rows.map((r) => r[p.x!]);
    const e = edgesOf(xs, win);
    if (!e || (!e.first && !e.last)) return p;
    changed = true;
    const first = e.first ? marked(p.markers, String(xs[e.lo]), "partial") : p.markers;
    return { ...p, markers: e.last ? marked(first, String(xs[e.hi]), last) : first };
  });
  return changed ? { ...visual, panels } : visual;
}

const ordinal = (n: number) => `${n}${n % 10 === 2 && n % 100 !== 12 ? "nd" : n % 10 === 3 && n % 100 !== 13 ? "rd" : n % 10 === 1 && n % 100 !== 11 ? "st" : "th"}`;

/* a year in a reading keeps its four digits: 2026 after a month, "in" or "since" */
const YEAR = /^(199\d|20[0-3]\d)$/;
const YEAR_BEFORE = /(?:\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?(?:\s+\d{1,2})?,?|\b(?:in|since))\s+$/i;

/** the callouts as one paragraph: every sentence closed, no 1.395e+6, short addresses, figures and times as people read them */
export function reads(callouts: string[]): string {
  return callouts
    .map((c) =>
      c
        .trim()
        .replace(/\b\d+(?:\.\d+)?e[+-]?\d+\b/gi, (m) => formatNumber(Number(m)))
        // an address or a hash reads the way the charts write it
        .replace(/\b0x(?:[0-9a-fA-F]{64}|[0-9a-fA-F]{40})\b/g, (m) => truncate(m.toLowerCase(), 6))
        // a long decimal reads to three figures: 9.39, never 9.39486
        .replace(/(?<![\w.,])\d{1,4}\.\d{3,}(?![\w.])/g, (m) => (Number(m) >= 0.001 && m.replace(".", "").replace(/^0+/, "").length > 3 ? String(Number(Number(m).toPrecision(3))) : m))
        // a bare figure of four digits or more gets its separators: 2,095 and 14,302; a year stays a year
        .replace(/(?<![\w.,#…-])\d{4,}(?:\.\d+)?(?![\w,-])/g, (m: string, at: number, s: string) => (YEAR.test(m) && YEAR_BEFORE.test(s.slice(Math.max(0, at - 24), at)) ? m : formatNumber(Number(m))))
        // a time reads to the minute: 05:35, never 05:35:00
        .replace(/\b(\d{2}:\d{2}):00\b/g, "$1"),
    )
    .filter(Boolean)
    .map((c) => (/[.!?]$/.test(c) ? c : `${c}.`))
    .join(" ");
}

/** a note in pieces for the page to draw: its text, and each address or hash the writer named in full,
    short as readings write it */
export function noteParts(text: string): { text: string; hex?: string }[] {
  const out: { text: string; hex?: string }[] = [];
  let last = 0;
  for (const m of text.matchAll(/\b0x(?:[0-9a-fA-F]{64}|[0-9a-fA-F]{40})\b/g)) {
    const at = m.index ?? 0;
    if (at > last) out.push({ text: text.slice(last, at) });
    const hex = m[0].toLowerCase();
    out.push({ text: truncate(hex, 6), hex });
    last = at + m[0].length;
  }
  if (last < text.length) out.push({ text: text.slice(last) });
  return out;
}

/* the selection rides along with a follow-up after this mark, so the
   question the reader sees stays the one they typed; the city's window
   scopes a P-Chain question to a picked L1 the same way */
export const FILTER_MARK = "\n\n(Only the rows where ";

/** under an answer: what the server's own tables it read cover, and how recent they are, in the server's words */
export function sourceLines(a: Pick<QueryAnswer, "sources">): string[] {
  return (a.sources ?? []).map((s) => s.text).filter(Boolean);
}

/** under every answer: the figures rest on SQL a model wrote */
export const SQL_CAVEAT = "The SQL behind this answer is written by an AI model and may not be 100% accurate. Check it before you rely on a figure.";
