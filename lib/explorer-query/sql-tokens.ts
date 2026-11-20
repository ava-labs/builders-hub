/* The SQL editor's reading of a query's text: its tokens, to color, and
   the place an error's message points at. Pure, so the page and the tests
   share it. The guard has a tokenizer of its own (guard.ts), which reads
   what a query does and drops the spaces; this one keeps every character,
   so the colored text lies exactly under the typed text. */

export type SqlTokenKind = "keyword" | "function" | "string" | "number" | "comment" | "ident" | "macro" | "punct" | "text";

export interface SqlToken {
  kind: SqlTokenKind;
  text: string;
}

/** the words ClickHouse reads as part of a SELECT's grammar, in capitals */
const KEYWORDS = new Set(
  `SELECT FROM WHERE PREWHERE GROUP BY ORDER HAVING LIMIT OFFSET WITH AS AND OR NOT IN BETWEEN LIKE ILIKE IS NULL TRUE FALSE
   CASE WHEN THEN ELSE END DISTINCT ON USING JOIN INNER LEFT RIGHT FULL OUTER CROSS ASOF ANY ALL SEMI ANTI GLOBAL PASTE ARRAY
   UNION EXCEPT INTERSECT ASC DESC NULLS FIRST LAST FILL STEP TO INTERVAL OVER PARTITION WINDOW ROWS RANGE UNBOUNDED PRECEDING
   FOLLOWING CURRENT ROW QUALIFY FINAL SAMPLE TIES TOTALS ROLLUP CUBE EXISTS SECOND MINUTE HOUR DAY WEEK MONTH QUARTER YEAR
   SETTINGS FORMAT INSERT UPDATE DELETE ALTER DROP CREATE TRUNCATE`.split(/\s+/),
);

/** keywords that are also a function's name: left(s, 3), any(x), range(10), array(1, 2), year(t) */
const CALLABLE = new Set("LEFT RIGHT ANY ARRAY RANGE FORMAT SECOND MINUTE HOUR DAY WEEK MONTH QUARTER YEAR".split(" "));

/** what a token starts with, tried in this order; a string, a quoted name or a comment left open runs to the end */
const RULES: [SqlTokenKind | "word", RegExp][] = [
  ["text", /\s+/y],
  ["comment", /--[^\n]*|\/\*[\s\S]*?(?:\*\/|$)/y],
  ["string", /'(?:[^'\\]|\\[\s\S]?|'')*(?:'|$)/y],
  ["ident", /`(?:[^`\\]|\\[\s\S]?)*(?:`|$)|"(?:[^"\\]|\\[\s\S]?)*(?:"|$)/y],
  ["macro", /\$[A-Za-z_]\w*/y],
  ["number", /0[xX][0-9a-fA-F]+|(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?/y],
  ["word", /[A-Za-z_]\w*/y],
  ["punct", /<=|>=|<>|!=|==|\|\||::|->|[()[\]{},.;+\-*/%=<>!|:?]/y],
];

const CALL = /\s*\(/y;

/** a bare word: a keyword, a function when a parenthesis follows it, else a name */
function wordKind(word: string, sql: string, end: number): SqlTokenKind {
  CALL.lastIndex = end;
  const called = CALL.test(sql);
  const upper = word.toUpperCase();
  if (KEYWORDS.has(upper) && !(called && CALLABLE.has(upper))) return "keyword";
  return called ? "function" : "ident";
}

/** the query as tokens whose texts, joined, are the query again. A name is an ident, quoted or bare; spaces and any
    character SQL has no use for are text */
export function tokenize(sql: string): SqlToken[] {
  const out: SqlToken[] = [];
  let at = 0;
  while (at < sql.length) {
    let kind: SqlTokenKind = "text";
    let text = sql[at];
    for (const [k, re] of RULES) {
      re.lastIndex = at;
      const m = re.exec(sql);
      if (!m) continue;
      text = m[0];
      kind = k === "word" ? wordKind(text, sql, at + text.length) : k;
      break;
    }
    // runs of text stay one token, so a character of two code units is never split
    const last = out[out.length - 1];
    if (kind === "text" && last?.kind === "text") last.text += text;
    else out.push({ kind, text });
    at += text.length;
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* Where an error points. The server does not send the editor's text as
   it is: it writes the shorthand out, adds a LIMIT, and wraps the query
   in a WITH of its own (sources.ts), so the position and the line in a
   ClickHouse message count the sent text, not the typed one. The message
   also quotes the query from the failure on, and that text is looked up
   in the editor's SQL; the number alone stands only when nothing is
   quoted. A message about a name (an unknown column, a table the guard
   refuses) points at the name's first use. */

export interface SqlPlace {
  /** from 1, as the gutter counts */
  line: number;
  col?: number;
}

/** an offset into the text, as a line and a column from 1 */
function placeOf(sql: string, offset: number): SqlPlace {
  const before = sql.slice(0, offset);
  return { line: before.split("\n").length, col: offset - before.lastIndexOf("\n") };
}

const escaped = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** "failed at position 31 ('FORM') (line 2, col 3): FORM raw_blocks …. Expected one of: …"; the token and the line are
    not in every message, and "(end of query)" stands in the token's place at the end */
const SYNTAX = /failed at position (\d+)(?: \((?:'[\s\S]*?'|end of query)\))?(?: \(line (\d+), col (\d+)\))?(?::\s*([\s\S]*))?/;
/** where ClickHouse's advice starts, after the text it quotes */
const ADVICE = /\.\s+(?:Expected|Unrecognized|Unmatched|Max query size)\b/;
/** a failure at the query's end, or in what the server puts after it: nothing, its LIMIT, its closing parenthesis */
const TAIL = /^\s*(?:LIMIT \d+)?\s*\)?\s*$/;

function syntaxPlace(message: string, sql: string): SqlPlace | null {
  const m = SYNTAX.exec(message);
  if (!m) return null;
  const lines = sql.split("\n");
  const line = Number(m[2]);
  // the place as the message counts it; right when the text went to ClickHouse as it was typed
  const reported = m[2] ? (line <= lines.length ? lines.slice(0, line - 1).join("\n").length + (line > 1 ? 1 : 0) + Number(m[3]) - 1 : -1) : Number(m[1]) - 1;
  const inside = reported >= 0 && reported <= sql.length;
  if (m[4] === undefined) return inside ? placeOf(sql, reported) : null;
  const quoted = m[4].split(ADVICE)[0];
  // the quoted text, with any spacing, and again without the parenthesis the server closes its wrapper with
  for (const text of [quoted, quoted.replace(/\s*\)\s*$/, "")]) {
    const words = text.trim().slice(0, 48).split(/\s+/).filter(Boolean);
    if (words.length === 0 || text.trim() === ")") continue;
    const found = [...sql.matchAll(new RegExp(words.map(escaped).join("\\s+"), "g"))].map((x) => x.index);
    // the quoted text runs to the query's end, so of several places the last is the one, unless the message's own fits
    if (found.length) return placeOf(sql, inside && found.includes(reported) ? reported : found[found.length - 1]);
  }
  return TAIL.test(quoted) ? placeOf(sql, sql.trimEnd().length) : null;
}

/** the name a message is about: the guard writes it bare after a fixed word, ClickHouse quotes it */
const NAMED: RegExp[] = [
  /^(?:table (?:function )?|the alias |IN )(\w+(?:\.\w+)*)/,
  /^write (\w+) without a database name/,
  /^(\$?\w+) is (?:not allowed|no shorthand|a table here)/,
  /^unhex\('(\w+)'\)/,
  /Unknown (?:\w+ )*identifier:? [`']?(\w+(?:\.\w+)*)/,
  /Missing columns: '(\w+(?:\.\w+)*)'/,
  /Unknown function (\w+)/,
  /Function with name [`'](\w+)[`'] does not exist/,
  /Table (?:\w+\.)?(\w+) (?:does not|doesn't) exist/,
];

/** where in the editor's SQL an error's message points, or null when it names no place the text holds */
export function errorPosition(message: string, sql: string): SqlPlace | null {
  if (!message || !sql) return null;
  if (/failed at position \d+/.test(message)) return syntaxPlace(message, sql);
  for (const re of NAMED) {
    const name = re.exec(message)?.[1];
    if (!name) continue;
    const at = new RegExp(`(?<![\\w$])${escaped(name)}(?!\\w)`, "i").exec(sql);
    if (at) return placeOf(sql, at.index);
  }
  return null;
}
