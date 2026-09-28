/* A writer hands back its note with the final query, before the query's rows come back, so the note can
   say "no flash loans" over rows that hold $796.85, give a figure where the rows hold only zeros, or give
   the total an earlier test returned ("of 48,336 total borrowers" over rows whose of_total is 48,292). Each
   note sentence that says there is none of something is held against the rows' figures for it, a figure
   the note gives against rows that are all zero, and a count or a total the note gives against the column
   that holds it. */

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

/* A count or a total the note gives: a figure written as a total (of 48,336, a total of 48,336, 48,336 in
   all) or named for what it counts (1,234 swaps), held against the one column of the rows that holds such a
   figure for all of them. A figure no column holds is left alone. */

/** a column that holds a count or a total: of_total, total, total_borrowers, borrower_count */
const TOTAL = /(?:^|_)(?:of_total|total|count|cnt)(?:_|$)/i;
/** a figure as a note writes it: 48,336, 48.3k, $1.8B; never part of a word, a version, a date or a time */
const NUMBER = /(?<![\w.,$:/-])(\$\s?)?(\d{1,3}(?:,\d{3})+|\d+)(?:\.(\d+))?(?:\s?([kKmMbB])(?![a-zA-Z]))?(?![\d,.:/]?\d|\s?%|\s?percent)/g;
/** what a figure stands next to, before it (of 48,336) and after it (48,336 total borrowers, 48,336 in all) */
const AS_TOTAL_BEFORE = /\b(?:of|out\s+of|among|a\s+total\s+of)\s+$/i;
const AS_TOTAL_AFTER = /^\s*(?:total\b|in\s+(?:total|all)\b|overall\b)/i;
/** a bound or a guess (over 48,000, about 48k), or the rank of the rows listed (the top 15, the 15 largest) */
const LOOSE = /(?:\b(?:about|around|roughly|nearly|almost|approximately|over|above|under|below|more\s+than|less\s+than|fewer\s+than|at\s+least|at\s+most|up\s+to|some|top|first|last)|~)\s*$/i;
const RANKED = /^\s*(?:largest|biggest|top|most|highest|lowest|smallest|busiest|leading|main|first|last)\b/i;
/** a span of time or a date part the figure is a number of */
const SPAN = /^\s*(?:seconds?|minutes?|hours?|days?|weeks?|months?|years?|blocks?|bps|basis|times|x)\b/i;
const MONTHS = /\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\.?\s+$/i;
const SCALE: Record<string, number> = { k: 1e3, m: 1e6, b: 1e9, thousand: 1e3, million: 1e6, billion: 1e9 };
/** words a count's noun may stand behind: 48,336 total borrowers, 1,234 unique traders */
const BEFORE_NOUN = new Set(["total", "unique", "distinct", "active", "different", "individual", "new", "all"]);
const NOT_A_NOUN = new Set(["of", "total", "count", "cnt", "num", "number", "unique", "distinct", "usd"]);
/** a word after a figure that names nothing it counts: of 48,336 on the protocol */
const FUNCTION = new Set(["on", "in", "at", "by", "for", "from", "with", "to", "of", "the", "a", "an", "this", "that", "now", "today", "and", "or", "as", "since", "across", "per", "so", "is", "are", "was", "were"]);
const nounsOf = (name: string) => new Set(name.replace(/([a-z])([A-Z])/g, "$1_$2").toLowerCase().split(/[^a-z0-9]+/).filter((w) => w && !NOT_A_NOUN.has(w)).map(stem));

/** the columns that hold one count or total for all the rows: a count or a total column the same in every row, or
    any number column of a one-row answer */
function heldTotals(r: Rows): { name: string; value: number; usd: boolean; total: boolean; nouns: Set<string> }[] {
  return r.columns
    .filter((c) => NUMERIC.test(c.type) && (r.rows.length === 1 || TOTAL.test(c.name)))
    .flatMap((c) => {
      const values = r.rows.map((row) => Number(row[c.name]));
      const v = values[0];
      if (!values.length || !Number.isFinite(v) || v === 0 || values.some((x) => x !== v)) return [];
      return [{ name: c.name, value: v, usd: /(?:^|_)usd(?:_|$)/i.test(c.name), total: TOTAL.test(c.name), nouns: nounsOf(c.name) }];
    });
}

/** the figure written the way the note wrote the one it stands for: 48292 as 48,292 after 48,336, 48.3k after 48.1k */
function written(v: number, like: { usd: boolean; commas: boolean; decimals: number; suffix: string; space: string }): string {
  const scale = SCALE[like.suffix.toLowerCase()] ?? 1;
  const n = v / scale;
  const body = like.commas ? n.toLocaleString("en-US", { minimumFractionDigits: like.decimals, maximumFractionDigits: like.decimals }) : n.toFixed(like.decimals);
  return `${like.usd ? "$" : ""}${body}${like.suffix ? `${like.space}${like.suffix}` : ""}`;
}

/** each count or total a sentence gives that the column holding it contradicts, and the sentence with the column's
    figures; count is the number of rows listed */
function totalsAgainst(s: string, held: ReturnType<typeof heldTotals>, count: number, rowsKind: Set<string>): { said: string[]; fixed: string } | null {
  let fixed = "";
  let at = 0;
  const said: string[] = [];
  for (const m of s.matchAll(NUMBER)) {
    const [text, dollar, int, dec, suffix] = m;
    const before = s.slice(0, m.index);
    const after = s.slice(m.index + text.length);
    const worded = /^\s*(thousand|million|billion)\b/i.exec(after);
    const unitWord = suffix ?? worded?.[1] ?? "";
    const rest = worded ? after.slice(worded[0].length) : after;
    if ((!dollar && !dec && !unitWord && /^(?:19|20)\d\d$/.test(int)) || LOOSE.test(before) || MONTHS.test(before) || RANKED.test(rest) || SPAN.test(rest)) continue;
    const digits = int.replace(/,/g, "");
    const scale = SCALE[unitWord.toLowerCase()] ?? 1;
    const value = Number(dec ? `${digits}.${dec}` : digits) * scale;
    if (!(value > 0)) continue;
    // half the last unit the note shows: 48,336 is exact to 0.5, 48.3k to 50, 48,000 to 500
    const unit = (dec ? 10 ** -dec.length : 10 ** (/0*$/.exec(digits)?.[0].length ?? 0)) * scale;
    const kind = held.filter((h) => h.usd === !!dollar);
    const word = rest.replace(AS_TOTAL_AFTER, "").toLowerCase().split(/[^a-z]+/).filter(Boolean).find((w) => !BEFORE_NOUN.has(w));
    const noun = word && !FUNCTION.has(word) ? stem(word) : undefined;
    const named = noun ? kind.filter((h) => h.nouns.has(noun)) : [];
    const asTotal = AS_TOTAL_BEFORE.test(before) || AS_TOTAL_AFTER.test(rest);
    // a total column that names nothing (of_total) counts the rows' own kind: the note's total is of that kind, or of nothing named
    const ofRows = kind.filter((h) => h.total && !h.nouns.size && (!noun || rowsKind.has(noun)));
    // written as a total, it is the total column it names, or else the one of the rows' kind; named for what it counts,
    // it is that column, unless its clause qualifies it (12 borrowers hold over $1M) or it counts the rows listed
    const col = asTotal
      ? named.length === 1 ? named[0] : !named.length && ofRows.length === 1 ? ofRows[0] : null
      : named.length === 1 && !PART.test(rest.split(/[,;]/)[0]) && value !== count ? named[0] : null;
    if (!col || Math.abs(col.value - value) <= unit / 2 + 1e-9 * Math.abs(value)) continue;
    const like = { usd: !!dollar, commas: int.includes(","), decimals: dec?.length ?? 0, suffix: suffix ?? "", space: /\s[kKmMbB]$/.test(text) ? " " : "" };
    // a figure with its scale in words (1.8 million) keeps the words, and takes the column's figure in that scale
    const theirs = worded ? written(col.value / scale, like) : written(col.value, like);
    said.push(`the note gives ${text.trim()}${worded ? ` ${worded[1]}` : ""} ("${s.trim()}"), but the rows' ${col.name} is ${written(col.value, { ...like, suffix: "", decimals: Number.isInteger(col.value) ? 0 : Math.max(like.decimals, 2), commas: true })}.`);
    fixed += s.slice(at, m.index) + theirs;
    at = m.index + text.length;
  }
  return said.length ? { said, fixed: fixed + s.slice(at) } : null;
}

/** each note sentence the rows contradict, with the rows' figure for the writer */
export function contradictions(note: string, title: string, r: Rows): { sentence: string; error: string; fix?: string }[] {
  const figures = figuresOf(r);
  const held = heldTotals(r);
  if (!figures.length && !held.length && r.rowCount > 0) return [];
  const out: { sentence: string; error: string; fix?: string }[] = [];
  // what the rows are: the words of their text columns (borrower_address) and of the title
  const rowsKind = new Set([...r.columns.filter((c) => !NUMERIC.test(c.type)).flatMap((c) => [...nounsOf(c.name)]), ...wordsOf(title)]);
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
    // a count or a total the column that holds it contradicts: the sentence comes back with the column's figure
    const totals = held.length ? totalsAgainst(s, held, r.rows.length, rowsKind) : null;
    if (totals) {
      out.push({ sentence: s, error: totals.said.join(" "), fix: totals.fixed });
      continue;
    }
    // the reverse: a figure the note gives, over rows that hold none
    const figure = zero ? [...s.matchAll(FIGURE)].map((m) => (m[1] ?? m[2]).trim()).find((f) => !/^(?:19|20)\d\d$/.test(f) && Number(f.replace(/[$,\s]|[kKmMbB]$/g, "")) > 0) : undefined;
    if (figure) out.push({ sentence: s, error: `the note gives ${figure} ("${s.trim()}"), but ${r.rowCount === 0 ? "the query returned no rows" : "every figure in the rows is 0"}.` });
  }
  return out;
}

/** the note without the sentences its rows contradict, and with the rows' figure for a count or a total it gave */
export function withoutContradictions(note: string, title: string, r: Rows): string {
  const found = new Map(contradictions(note, title, r).map((c) => [c.sentence, c.fix]));
  return found.size ? sentences(note).flatMap((s) => (!found.has(s) ? [s] : found.get(s) ? [found.get(s)!] : [])).join(" ") : note;
}
