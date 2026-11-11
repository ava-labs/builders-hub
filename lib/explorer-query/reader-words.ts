/* the words a reading may hold: its rules, the query's parts it never names, and each address in full */

import type { Names } from "./types";
import type { DesignInput } from "./figures";
import type { VisualSpec } from "./visual-spec";
import { averageLabel } from "./stat-label";

/* how a reading speaks, for the designer's callouts and the reader's sentences alike: in the reader's
   words, in the right units, with the right verbs */
export const READER_RULES =
  "Write for a reader, not the database: no column names and no SQL words (rows displayed, first rows, sample, LIMIT, topic0, to_address), no 'hourly snapshot', and L1, never subnet. Units: an L1 validator's weight is a weight, never AVAX; gas_used summed over transactions is gas charged, not gas reserved; a total per day is not the size of one delegation. Verbs: an address pays or uses gas, it does not charge it; a validator sets a delegation fee. Figures says under Edges whether the first and last periods are complete: never call a partial or filling one a dip or a jump, and when one holds the highest value, name the highest complete period too; a period Edges calls complete is complete. With no Edges line, the first and last periods can be partial: never call them a dip or a jump. Call a span of time a period, an hour or a day, never a bucket. A whole-result figure that Figures puts in a row not shown belongs to that row: never pin it on a row shown. Say every, only, never, all or none about the rows only when all the rows are shown or Figures says it, and take largest, highest and lowest from Figures. A step is the change between neighbouring rows: quote the largest rise or fall from Figures, and call a change across several rows a change over that span, never a step. A share names its base, the thing the rows count: 7.8% of method calls, never of all transactions unless the rows count every transaction. Take a share of the total from Figures when it gives one, never from rounded figures, and round a percent to its last shown digit by the usual rule: 45.54% is 45.5%. Chain transfers (A to B, then B to C) only when the amounts match and the times follow in order; else name each transfer on its own. The note carries the caveats: a callout adds none, and never words the note's caveat another way. Counts are not amounts: say how much AVAX or value moved only from a column that holds amounts, never from a count of transactions. Write each address and hash in a callout in full, as the rows give it, and never shorten one: the page shortens it. Say how many rows hold a figure only when Figures gives that count; never count rows yourself.";

/* The reader never sees the SQL, so no reader text names its parts: a
   snake_case name (seen_7d, to_address, p_validator_versions), one of the
   query's own names that holds a digit (topic0), or a comparison it makes
   (balance > 0, version = 'Unknown'). Nor does it say settled: a transaction
   on Avalanche is final. A bucket is never flagged: it reads as a period
   wherever reader text is written. */
const SNAKE = /\b[A-Za-z][A-Za-z0-9]*(?:_[A-Za-z0-9]+)+\b/g;
const DIGITED = /\b[A-Za-z]+\d[A-Za-z0-9]*\b/g;
const COMPARISON = String.raw`[a-z_][a-z0-9_]*\s*(?:[<>]=?|!=|<>|=)\s*(?:-?\d+(?:\.\d+)?|'[^']*'|[a-z_][a-z0-9_]*)`;
const COMPARE = new RegExp(String.raw`\b${COMPARISON}`, "g");
const IN_PARENS = new RegExp(String.raw`\s*\(\s*${COMPARISON}\s*\)`, "g");
/** the word the page never says of a transaction */
const SETTLED = /\bsettl(?:e|es|ed|ing)\b/gi;
/** reader text with each bucket read as a period, the page's word for a span of time */
export const plainWords = (s: string) => s.replace(/\b([Bb])ucket(s?)\b/g, (_, b: string, n: string) => `${b === "B" ? "P" : "p"}eriod${n}`);

/** a decimal as people read it: two places from 1 up, else three significant digits (3.24656 is 3.25, 0.0486849 is
    0.0487). Figures gives six digits, and the reader copied them into its sentences ("26.9643 gwei") */
export const plainDecimals = (s: string) =>
  s.replace(/(?<![\w.])\d+\.\d{4,}(?![\w.])/g, (m) => {
    const n = Number(m);
    return n >= 1 ? n.toFixed(2) : String(Number(n.toPrecision(3)));
  });

/** a query's own names that hold a digit (topic0), outside its quoted strings and comments */
export function sqlNames(sql: string): string[] {
  const code = sql.replace(/'(?:[^'\\]|\\.)*'/g, "''").replace(/--[^\n]*/g, "").replace(/\/\*[\s\S]*?\*\//g, "");
  return [...new Set(code.match(DIGITED) ?? [])];
}

/** the snake_case words the reader sees with the rows: in their values and in the names the server gave them (a
    contract called POPA_SUBMISSIONS_TIERS, a method remove_liquidity_one_coin). They are names, not the query's parts */
export function rowWords(rows: readonly Record<string, unknown>[], names: Names = {}): Set<string> {
  const out = new Set<string>();
  const add = (v: unknown) => {
    if (typeof v === "string") for (const w of v.match(SNAKE) ?? []) out.add(w);
  };
  for (const r of rows) Object.values(r).forEach(add);
  for (const m of Object.values(names)) Object.values(m).forEach(add);
  return out;
}

/** the words a reader text must not hold: the SQL's snake_case names, its own names and comparisons, and settled. A
    snake_case word the reader sees with the rows (shown) stays, unless it names a column too */
export function codeWords(text: string, names: readonly string[] = [], shown: ReadonlySet<string> = new Set()): string[] {
  const own = new Set(names);
  const snake = (text.match(SNAKE) ?? []).filter((w) => own.has(w) || !shown.has(w));
  return [...new Set([...snake, ...(text.match(DIGITED) ?? []).filter((w) => own.has(w)), ...(text.match(COMPARE) ?? []), ...(text.match(SETTLED) ?? [])])];
}

/** reader text in the page's words: a bucket reads as a period, and a sentence with a word the page never shows is left out */
export function withoutCode(text: string, names: readonly string[] = []): string {
  const worded = plainWords(text);
  if (codeWords(worded, names).length === 0) return worded;
  // a comparison in parentheses goes on its own, and the sentence around it stays
  return worded
    .replace(IN_PARENS, "")
    .split(/(?<=[.!?])\s+/)
    .filter((s) => codeWords(s, names).length === 0)
    .join(" ");
}

/** a label in the reader's words: seen_7d becomes seen 7d, settled becomes final, and a bucket a period. A name the
    reader sees (shown) stays as written */
export const plainLabel = (s: string, shown: ReadonlySet<string> = new Set()) => plainWords(s.replace(SNAKE, (w) => (shown.has(w) ? w : w.replace(/_/g, " "))).replace(/\b([Ss])ettled\b/g, (_, c: string) => (c === "S" ? "Final" : "final")));

/* An address in a reading is one the rows hold, written in full: the page
   shortens it. One a model shortened (0x1234…abcd, or its head alone:
   0x278d858f…) is written out again from the rows, and a callout that
   names an address the rows do not hold is left out. */
const FULL_HEX = /\b0x(?:[0-9a-fA-F]{64}|[0-9a-fA-F]{40})\b/g;
const SHORT_HEX = /\b0x([0-9a-fA-F]{2,10})(?:…|\.{2,3})(?:([0-9a-fA-F]{2,10})\b)?/g;

/** the addresses and hashes a reading may name: the rows' own, and those of the rows the whole-result figures point to */
export function heldHex(input: Pick<DesignInput, "rows" | "totals">): string[] {
  const held = new Set<string>();
  const add = (v: unknown) => {
    if (typeof v === "string" && /^0x(?:[0-9a-fA-F]{64}|[0-9a-fA-F]{40})$/.test(v)) held.add(v.toLowerCase());
  };
  for (const r of input.rows) Object.values(r).forEach(add);
  [...Object.values(input.totals?.maxAt ?? {}), ...Object.values(input.totals?.minAt ?? {})].forEach(add);
  return [...held];
}

/** a callout with each address in full, from the rows; null when it names one the rows do not hold */
export function withFullHex(c: string, held: readonly string[]): string | null {
  let lost = false;
  const out = c.replace(SHORT_HEX, (m, head: string, tail: string | undefined) => {
    const hit = held.filter((a) => a.startsWith(`0x${head.toLowerCase()}`) && a.endsWith((tail ?? "").toLowerCase()));
    if (hit.length === 0) lost = true;
    return hit.length === 1 ? hit[0] : m;
  });
  return lost || (out.match(FULL_HEX) ?? []).some((a) => !held.includes(a.toLowerCase())) ? null : out;
}

/** a callout's length as the page draws it: each full address and hash at its short form, 0x1234…abcd */
export const shownLength = (c: string) => c.replace(FULL_HEX, "0x0000…0000").length;

/** a visual in the reader's words: a snake_case name left in a label reads as words, and a callout that names a column,
    or an address the rows do not hold, is left out. A name the rows hold (shown) stays as written */
export function readerSpec(v: VisualSpec, names: readonly string[], held?: readonly string[], shown: ReadonlySet<string> = new Set()): VisualSpec {
  const kept = new Set([...shown].filter((w) => !names.includes(w)));
  const label = (s: string) => plainLabel(s, kept);
  const worded = <T extends { label: string }>(o: T): T => ({ ...o, label: label(o.label) });
  return {
    ...v,
    stats: v.stats.map((s) => averageLabel({ ...worded(s), ...(s.sub ? { sub: label(s.sub) } : {}) })),
    panels: v.panels.map((p) => ({ ...p, title: label(p.title), series: p.series.map(worded), markers: p.markers.map(worded), bands: p.bands.map(worded), referenceLines: p.referenceLines.map(worded) })),
    callouts: v.callouts.map((c) => plainDecimals(plainWords(c))).filter((c) => codeWords(c, names, shown).length === 0).map((c) => (held ? withFullHex(c, held) : c)).filter((c): c is string => c !== null),
  };
}
