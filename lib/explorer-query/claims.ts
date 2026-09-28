/* A writer hands back its note with the final query, before the query's rows come back, so the note can
   say "no flash loans" over rows that hold $796.85, or give a figure where the rows hold only zeros. Each
   note sentence that says there is none of something is held against the rows' figures for it, and a
   figure the note gives against rows that are all zero. */

import type { ColumnMeta } from "./clickhouse";

type Rows = { columns: readonly ColumnMeta[]; rows: readonly Record<string, unknown>[]; rowCount: number };

const NUMERIC = /^(Nullable\()?(U?Int\d+|Float\d+|Decimal)/;
/** columns that place, rank or size the rows rather than measure what they hold */
const PLACE = /^(?:of_total|chain_id|rank|row_number|n|block_number|block_height|height|year|month|week|day|hour|t|version|decimals)$/i;

/** a sentence that says there is none of something: No flash loans were borrowed; there were no liquidations; it
    recorded zero swaps; none of the pools */
const NONE = [
  /^\s*(?:no|zero)\s+([a-z][a-z0-9 -]{1,60}?)\s+(?:was|were|is|are|has|have|took|happened|occurred|came|moved|appeared|showed)\b/i,
  /^\s*(?:no|zero)\s+([a-z][a-z0-9 -]{1,40}?)\s+(?:this|today|yesterday|in|on|during|since|over|across|for)\b/i,
  /\bthere\s+(?:was|were|is|are|has\s+been|have\s+been)\s+(?:no|zero)\s+([a-z][a-z0-9 -]{1,60})/i,
  /\b(?:had|saw|recorded|found|logged|emitted|made|borrowed)\s+(?:no|zero)\s+([a-z][a-z0-9 -]{1,60})/i,
  /^\s*none\s+of\s+(?:the\s+)?([a-z][a-z0-9 -]{1,60})/i,
];
/** a none said of part of the rows (none over $1M, no pools but these) is not said of the figure */
const PART = /\b(?:over|above|below|under|more|less|larger|smaller|higher|lower|except|besides|other|outside|beyond|than|but)\b/i;
/** a figure a note gives: $796.85, 12 flash loans, 1.2M; never a year, a date, a time, a share or a span of time */
const FIGURE = /(\$\s?\d[\d,]*(?:\.\d+)?\s?[kKmMbB]?)|(?<![\w.$-])(\d[\d,]*(?:\.\d+)?\s?[kKmMbB]?)(?=\s+[a-z])(?!\s+(?:minutes?|hours?|days?|weeks?|months?|years?|seconds?|blocks?|bps|basis|percent|times|of\b))/g;
const STOP = new Set(["the", "a", "an", "of", "on", "in", "for", "this", "that", "week", "today", "day", "month", "any", "all", "total", "recorded", "events", "event", "were", "was", "chain", "c-chain"]);

/** a word as the two sides compare it: lower case, one form for one and many */
const stem = (w: string) => w.toLowerCase().replace(/(?:ies)$/, "y").replace(/(?:es|s)$/, "");
const wordsOf = (s: string) => new Set(s.toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length > 2 && !STOP.has(w)).map(stem));
const sentences = (text: string) => text.split(/(?<=[.!?])\s+/).filter((s) => s.trim());

/** the figures the rows hold, by column: each number column's values, the rows' own places left out */
function figuresOf(r: Rows): { name: string; values: number[] }[] {
  return r.columns
    .filter((c) => NUMERIC.test(c.type) && !PLACE.test(c.name))
    .map((c) => ({ name: c.name, values: r.rows.map((row) => Number(row[c.name] ?? 0)).filter(Number.isFinite) }));
}
const shown = (v: number) => (Number.isInteger(v) ? String(v) : String(Number(v.toPrecision(6))));

/** each note sentence the rows contradict, with the rows' figure for the writer */
export function contradictions(note: string, title: string, r: Rows): { sentence: string; error: string }[] {
  const figures = figuresOf(r);
  if (!figures.length && r.rowCount > 0) return [];
  const out: { sentence: string; error: string }[] = [];
  const zero = r.rowCount === 0 || figures.every((f) => f.values.every((v) => v === 0));
  for (const s of sentences(note)) {
    const none = NONE.map((re) => re.exec(s)).find(Boolean);
    if (none && !PART.test(s) && !zero) {
      const what = wordsOf(none[1] ?? "");
      // one row is the answer's own figure, of what the title names; over many, the column the sentence names, nonzero
      // in every row (a none said of one protocol may hold where another's row is not zero)
      const held = figures.filter((f) =>
        r.rowCount === 1
          ? f.values[0] !== 0 && [...what].some((w) => wordsOf(title).has(w) || wordsOf(f.name.replace(/_/g, " ")).has(w))
          : f.values.length > 0 && f.values.every((v) => v !== 0) && [...wordsOf(f.name.replace(/_/g, " "))].some((w) => what.has(w)),
      );
      if (held.length) {
        const said = held.slice(0, 3).map((f) => `${f.name} ${r.rowCount === 1 ? shown(f.values[0]) : `${shown(f.values.reduce((p, q) => p + q, 0))} over ${r.rowCount} rows`}`);
        out.push({ sentence: s, error: `the note says "${s.trim()}", but the rows hold ${said.join(", ")}.` });
        continue;
      }
    }
    // the reverse: a figure the note gives, over rows that hold none
    const figure = zero ? [...s.matchAll(FIGURE)].map((m) => (m[1] ?? m[2]).trim()).find((f) => !/^(?:19|20)\d\d$/.test(f) && Number(f.replace(/[$,\s]|[kKmMbB]$/g, "")) > 0) : undefined;
    if (figure) out.push({ sentence: s, error: `the note gives ${figure} ("${s.trim()}"), but ${r.rowCount === 0 ? "the query returned no rows" : "every figure in the rows is 0"}.` });
  }
  return out;
}

/** the note without the sentences its rows contradict */
export function withoutContradictions(note: string, title: string, r: Rows): string {
  const bad = new Set(contradictions(note, title, r).map((c) => c.sentence));
  return bad.size ? sentences(note).filter((s) => !bad.has(s)).join(" ") : note;
}
