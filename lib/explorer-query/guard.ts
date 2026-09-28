/* The gate every model-written query passes before ClickHouse sees it.
   One SELECT, over the raw tables and our reference tables only, on one
   chain, capped in rows. The guard is the safety boundary; the prompt is
   only advice. The shorthand a DEX query opens with is written out
   first (macros.ts), so the gate reads the whole text. A reference
   table's rows are spliced in after this gate (sources.ts). */

import { strayHex, typedLending } from "./lending";
import { expandMacros } from "./macros";
import { DEX_TOPICS } from "./protocols";
import { isFuji, targetOf } from "./target";

export type AllowedTable = string;

/** the most rows one answer may carry back to the browser */
export const MAX_ROWS = 2000;

const KEYWORDS = /\b(INSERT|UPDATE|DELETE|ALTER|DROP|CREATE|TRUNCATE|ATTACH|DETACH|OPTIMIZE|SYSTEM|KILL|GRANT|REVOKE|RENAME|EXCHANGE|USE|OUTFILE|SET|SETTINGS|FORMAT)\b/i;
/** table functions that read outside the database or spawn work */
const TABLE_FUNCTIONS = /\b(url|file|remote|remoteSecure|s3|s3Cluster|hdfs|azureBlobStorage|mysql|postgresql|sqlite|mongodb|redis|jdbc|odbc|executable|input|merge|cluster|clusterAllReplicas|dictionary|view|values|format|fileCluster|urlCluster|deltaLake|iceberg|hudi)\s*\(/i;

export type GuardResult = { ok: true; sql: string; tables: AllowedTable[] } | { ok: false; error: string };

/* ------------------------------------------------------------------ */
/* An alias over an expression of the column it is named after, such as
   hex(topic0) AS topic0, takes that name all through its SELECT: a bare
   topic0 in WHERE then reads the text, and the query matches nothing. */

/** a string, a quoted name, a word, a number, or one other character */
const TOKENS = /'(?:[^'\\]|\\.)*'|`(?:[^`\\]|\\.)*`|"(?:[^"\\]|\\.)*"|[A-Za-z_]\w*|\d+(?:\.\d+)?(?:e[+-]?\d+)?|\S/gi;
/** the words that end a WHERE, PREWHERE or ON */
const CLAUSE_END = new Set(["GROUP", "ORDER", "HAVING", "LIMIT", "WINDOW", "QUALIFY", "UNION", "EXCEPT", "INTERSECT", "JOIN", "INNER", "LEFT", "RIGHT", "FULL", "CROSS", "ARRAY", "GLOBAL", "ASOF", "PASTE", "USING", "WHERE", "PREWHERE", "ON"]);

interface Token {
  v: string;
  /** a name or a keyword; a quoted name is never a keyword */
  word: boolean;
  quoted: boolean;
  /** the SELECT it belongs to, and how deep in that SELECT's parentheses */
  select: number;
  depth: number;
}

function tokenize(sql: string): Token[] {
  const raw = sql.match(TOKENS) ?? [];
  // a parenthesis that opens a SELECT or a WITH starts a SELECT of its own; any other one stays in its SELECT, one deeper
  const frames = [{ select: 0, depth: 0, selects: 0 }];
  let selects = 0;
  return raw.map((r, i) => {
    const f = frames[frames.length - 1];
    if (r === "(") {
      frames.push(/^(SELECT|WITH)$/i.test(raw[i + 1] ?? "") ? { select: ++selects, depth: 0, selects: 0 } : { select: f.select, depth: f.depth + 1, selects: 1 });
      return { v: r, word: false, quoted: false, select: f.select, depth: f.depth };
    }
    if (r === ")") {
      if (frames.length > 1) frames.pop();
      const g = frames[frames.length - 1];
      return { v: r, word: false, quoted: false, select: g.select, depth: g.depth };
    }
    // the SELECT after a UNION or an EXCEPT is a SELECT of its own
    if (/^SELECT$/i.test(r) && f.depth === 0 && f.selects++ > 0) f.select = ++selects;
    const quoted = r[0] === "`" || r[0] === '"';
    return { v: quoted ? r.slice(1, -1) : r, word: quoted || /^[A-Za-z_]/.test(r), quoted, select: f.select, depth: f.depth };
  });
}

const keyword = (t: Token | undefined, ...words: string[]) => !!t && t.word && !t.quoted && words.includes(t.v.toUpperCase());

/** the aliases that name an expression over the column they are named after ("hex(l.topic0) AS topic0"); a column under its own name is not one */
function selfAliases(toks: Token[]): { name: string; select: number }[] {
  const found: { name: string; select: number }[] = [];
  const selects = new Set(toks.map((t) => t.select));
  for (const s of selects) {
    const at = toks.flatMap((t, i) => (t.select === s ? [i] : []));
    const start = at.find((i) => toks[i].depth === 0 && keyword(toks[i], "SELECT"));
    if (start === undefined) continue;
    const end = at.find((i) => i > start && toks[i].depth === 0 && keyword(toks[i], "FROM")) ?? toks.length;
    // the select list's items, split at its own commas
    let item: number[] = [];
    const items: number[][] = [];
    for (let i = start + 1; i < end; i++) {
      if (toks[i].select === s && toks[i].depth === 0 && toks[i].v === ",") {
        items.push(item);
        item = [];
      } else item.push(i);
    }
    items.push(item);
    for (const it of items) {
      const own = it.filter((i) => toks[i].select === s && toks[i].depth === 0);
      const [as, name] = own.slice(-2).map((i) => toks[i]);
      if (!keyword(as, "AS") || !name?.word) continue;
      const expr = it.slice(0, it.indexOf(own[own.length - 2])).filter((i) => toks[i].select === s);
      const plain = expr.every((i) => toks[i].word || toks[i].v === ".") && expr.filter((i) => toks[i].word).length <= 2;
      const over = expr.some((i) => toks[i].word && toks[i].v === name.v && toks[i + 1]?.v !== "(" && toks[i + 1]?.v !== ".");
      if (over && !plain) found.push({ name: name.v, select: s });
    }
  }
  return found;
}

/** the first alias over its own column whose name a WHERE, PREWHERE or ON of its SELECT writes bare; with anywhere, the first such alias at all */
export function shadowedAlias(sql: string, anywhere = false): string | null {
  const toks = tokenize(sql);
  for (const { name, select } of selfAliases(toks)) {
    if (anywhere) return name;
    let open = false;
    for (let i = 0; i < toks.length; i++) {
      const t = toks[i];
      if (t.select !== select) continue;
      if (t.depth === 0 && keyword(t, "WHERE", "PREWHERE", "ON")) open = true;
      else if (t.depth === 0 && t.word && !t.quoted && CLAUSE_END.has(t.v.toUpperCase())) open = false;
      else if (open && t.word && t.v === name && toks[i - 1]?.v !== "." && toks[i + 1]?.v !== "(" && toks[i + 1]?.v !== ".") return name;
    }
  }
  return null;
}

/* ------------------------------------------------------------------ */
/* unhex reads any text as bytes: it pads an odd count of digits with a
   0 and turns 0x or a letter past f into a byte, so a literal typed
   wrong matches no row, and the answer says there was nothing. */

/** the hex digits of a column's bytes: an address's 20, a topic's or a hash's 32 */
const DIGITS: [RegExp, number][] = [
  [/^(address|tx_from|tx_to|from_address|to_address|contract_address)$/i, 40],
  [/^(topic[0-3]|transaction_hash|block_hash|tx_hash)$/i, 64],
];

/** why a literal in unhex('…') is no address, topic or hash, or null: its text, or its length beside the column it is
    compared with (column = unhex('…'), or each one in a list, column IN (…)). An IN over a subquery holds the column
    against the subquery's rows, so the literals inside it are held against their own columns */
function badHex(sql: string): string | null {
  const shown = (h: string) => (h.length > 16 ? `${h.slice(0, 8)}…${h.slice(-6)}` : h);
  for (const m of sql.matchAll(/\bunhex\s*\(\s*'([^']*)'\s*\)/gi)) {
    const h = m[1];
    if (/^0x/i.test(h)) return `unhex('${shown(h)}') starts with 0x, which unhex reads as a byte: write the hex digits alone`;
    if (!/^[0-9a-f]*$/i.test(h)) return `unhex('${shown(h)}') has a character that is not a hex digit, so it matches nothing`;
    if (h.length % 2) return `unhex('${shown(h)}') has ${h.length} hex digits, so it matches nothing: an address has 40, a topic or a hash 64`;
  }
  for (const m of sql.matchAll(/\b(\w+)\s*(=|IN\s*\()/gi)) {
    const digits = DIGITS.find(([name]) => name.test(m[1]))?.[1];
    if (!digits) continue;
    const from = (m.index ?? 0) + m[0].length;
    let to = from;
    if (m[2] !== "=") for (let depth = 1; to < sql.length && depth > 0; to++) depth += sql[to] === "(" ? 1 : sql[to] === ")" ? -1 : 0;
    const text = m[2] === "=" ? /^\s*unhex\s*\(\s*'[^']*'\s*\)/.exec(sql.slice(from))?.[0] ?? "" : sql.slice(from, to);
    if (m[2] !== "=" && /^[\s(]*(SELECT|WITH)\b/i.test(text)) continue;
    const wrong = [...text.matchAll(/unhex\s*\(\s*'([0-9a-f]*)'\s*\)/gi)].map((l) => l[1]).find((h) => h.length !== digits);
    if (wrong !== undefined) return `unhex('${shown(wrong)}') has ${wrong.length} hex digits, and ${m[1]} holds ${digits}, so it matches nothing`;
  }
  return null;
}

/* ------------------------------------------------------------------ */
/* legs holds the window's Swap logs, one row each, with every figure a
   query reads of a swap. A DEX query that reads those logs from raw_logs
   again, or joins raw_logs to legs, gets each swap back once for every
   log it matches: an lb swap that crosses n bins is n logs. */

/** the Swap topics legs is made from, by the names the DEX WITH gives them or as literals */
const LEGS_SWAPS = new RegExp(`\\b(v2_swap|v3_swap|lb_swap|v4_swap)\\b|unhex\\s*\\(\\s*'(${[DEX_TOPICS.v2Swap, DEX_TOPICS.v3Swap, DEX_TOPICS.lbSwap, DEX_TOPICS.v4Swap].join("|")})'\\s*\\)`, "i");
const LEGS_HAS = "legs has pool, block_time, block_number, tx (the log's transaction_hash), trader (its tx_from), router (its tx_to), protocol, version, t0, t1, k, r0, r1 and usd: read them FROM legs alone";

/** why the query after the $DEX shorthand reads raw_logs where legs holds the rows, or null. A read of another event (a
    Transfer, a Sync, or WOOFi's WooSwap, which legs lacks) passes, and so does a filter by its transactions or pools */
function legsAgain(own: string): string | null {
  const toks = tokenize(own);
  // the tables each SELECT reads by name; a subquery, an ARRAY JOIN and a WITH FILL FROM name none
  const reads = new Map<number, Set<string>>();
  toks.forEach((t, i) => {
    if (t.depth !== 0 || !keyword(t, "FROM", "JOIN") || keyword(toks[i - 1], "ARRAY", "FILL")) return;
    const name = toks[i + 2]?.v === "." ? toks[i + 3] : toks[i + 1];
    if (name?.word) reads.set(t.select, (reads.get(t.select) ?? new Set<string>()).add(name.v.toLowerCase()));
  });
  const selects = [...reads.values()];
  if (!selects.some((s) => s.has("raw_logs"))) return null;
  if (LEGS_SWAPS.test(own))
    return `this $DEX query reads the window's Swap logs from raw_logs again, and legs holds them already, one row per log. ${LEGS_HAS}. A drill into the Swap logs themselves opens with $POOLS(), as the worked examples do`;
  if (selects.some((s) => s.has("raw_logs") && (s.has("legs") || s.has("swap_logs"))))
    return `this $DEX query joins raw_logs to legs, so each swap comes back once for every log it matches (an lb swap that crosses n bins is n logs). ${LEGS_HAS}. For the swaps of the transactions or pools another event names, filter legs with tx IN (SELECT transaction_hash FROM raw_logs WHERE …) or pool IN (SELECT …)`;
  return null;
}

export function guardSql(raw: string, chainId: number): GuardResult {
  const target = targetOf(chainId);
  let sql = String(raw ?? "").trim().replace(/;+\s*$/, "").trim();
  if (!sql) return { ok: false, error: "empty query" };
  // a literal typed wrong reads no rows: the writer's own text, before the shorthand is written out
  const typed = isFuji(chainId) ? null : (badHex(sql) ?? strayHex(sql, chainId));
  if (typed) return { ok: false, error: typed };
  // the shorthand is written out before any check, and the length counts the whole text
  const x = expandMacros(sql, chainId);
  if (!x.ok) return x;
  sql = x.sql;
  // what the writer typed after $DEX reads the Swap logs from legs, never from raw_logs a second time
  const again = x.macro?.name === "DEX" ? legsAgain(sql.slice(x.macro.size)) : null;
  if (again) return { ok: false, error: again };
  if (sql.length > 6000) {
    const m = x.macro;
    return { ok: false, error: m ? `query too long: ${sql.length} characters with $${m.name} written out, 6000 at most. Its WITH takes ${m.size}, so what follows it may take ${6000 - m.size}` : "query too long (6000 chars max)" };
  }
  if (sql.includes(";")) return { ok: false, error: "one statement only; no semicolons" };
  if (/--|\/\*|\*\//.test(sql)) return { ok: false, error: "no comments in the query" };
  // the shorthand stands for text on the mainnet C-Chain only; elsewhere a query writes its WITH out
  if (/\$(DEX|POOLS|START|PROTOCOL)\b/.test(sql)) return { ok: false, error: "write the DEX WITH out in full: $DEX, $POOLS, $START and $PROTOCOL stand for its text" };
  // hashes, addresses and topics are bytes already: unhex reads each of their bytes as a hex digit
  if (!isFuji(chainId) && /\bhex\s*\(\s*unhex\s*\(/i.test(sql)) return { ok: false, error: "hex(unhex(x)) garbles x: hashes, addresses and topics are bytes already, so write lower(concat('0x', hex(x)))" };
  if (!/^(SELECT|WITH)\b/i.test(sql)) return { ok: false, error: "the query must start with SELECT or WITH" };
  const kw = sql.match(KEYWORDS);
  if (kw) return { ok: false, error: `${kw[1].toUpperCase()} is not allowed; write a plain SELECT (the server sets FORMAT and settings)` };
  const fn = sql.match(TABLE_FUNCTIONS);
  if (fn) return { ok: false, error: `table function ${fn[1]}() is not allowed` };
  if (/\bsystem\b/i.test(sql) || /\binformation_schema\b/i.test(sql)) return { ok: false, error: "system tables are not readable here" };
  // the server reads the tables that hold duplicate rows through FINAL itself (sources.ts), and
  // ClickHouse refuses a FINAL over that read, so a query's own FINAL after one of them is dropped
  if (target.final.length) sql = sql.replace(new RegExp(`\\b(${target.final.join("|")})\\b((?:\\s+(?:AS\\s+)?(?!FINAL\\b)[A-Za-z_]\\w*)?)\\s+FINAL\\b`, "gi"), "$1$2");

  // every table read must be one of the raw tables, or a reference table our server builds (sources.ts)
  // names a WITH defines (WITH snaps AS (…)) are the query's own, not tables
  const ctes = new Set([...sql.matchAll(/(?:\bWITH|,)\s*([A-Za-z_]\w*)\s+AS\s*\(/gi)].map((m) => m[1].toLowerCase()));
  // a WITH may not take the name of a table the server defines
  const taken = [...target.refs, ...target.final].find((r) => ctes.has(r));
  if (taken) return { ok: false, error: `${taken} is a table here; give the WITH another name` };
  const readable = [...target.tables, ...target.refs];
  const tables = new Set<AllowedTable>();
  // ORDER BY t WITH FILL FROM <expr> names a value, not a table, and so does ARRAY JOIN <array>
  const refs = sql.matchAll(/(?<!\bFILL\s+)(?<!\bARRAY\s+)\b(?:FROM|JOIN)\s+(?!\()([`"]?)([A-Za-z_][\w.]*)\1/gi);
  for (const m of refs) {
    const ident = m[2].replace(/^default\./i, "");
    if (ctes.has(ident.toLowerCase())) continue;
    if (!readable.includes(ident)) {
      return { ok: false, error: `table ${m[2]} is not readable here; use ${readable.join(", ")}` };
    }
    // the server's definitions answer to the bare name only
    if (ident !== m[2] && (target.refs.includes(ident) || target.final.includes(ident))) return { ok: false, error: `write ${ident} without a database name` };
    tables.add(ident as AllowedTable);
  }
  if (tables.size === 0) return { ok: false, error: typedLending(sql, chainId) ?? `the query reads no table; use ${readable.join(", ")}` };
  const shadow = shadowedAlias(sql);
  if (shadow) return { ok: false, error: `the alias ${shadow} hides the column ${shadow}, so its WHERE or ON reads the alias; give the alias another name` };

  // one chain: the sort keys start with chain_id, so this is also what
  // keeps a query from scanning every chain in the partition
  const chainRe = new RegExp(`\\bchain_id\\s*(=|==)\\s*${chainId}\\b`);
  if (!chainRe.test(sql)) return { ok: false, error: `filter every table on chain_id = ${chainId}` };
  const otherChain = sql.match(/\bchain_id\s*(=|==)\s*(\d+)/g)?.find((s) => !new RegExp(`\\b${chainId}\\b`).test(s));
  if (otherChain) return { ok: false, error: `only chain_id = ${chainId} is readable on this page` };

  // the big tables hold years; a read with no window scans all of them
  const wide = [...tables].filter((t) => target.wide.includes(t));
  if (wide.length && !target.bound.test(sql)) {
    return {
      ok: false,
      error:
        target.kind === "pchain"
          ? `bound ${wide.join(", ")} on its time or height (block_time, snapshot_time, created_time, block_height; for snapshots, the latest snapshot_time)`
          : `bound ${wide.join(", ")} on block_time or block_number (for example block_time >= now() - INTERVAL 1 DAY)`,
    };
  }

  // rows: cap what comes back
  const lim = sql.match(/\bLIMIT\s+(\d+)(?:\s*,\s*(\d+))?/i);
  if (!lim) sql = `${sql}\nLIMIT ${MAX_ROWS}`;
  else {
    const n = Number(lim[2] ?? lim[1]);
    if (n > MAX_ROWS) return { ok: false, error: `LIMIT at most ${MAX_ROWS}; aggregate further or narrow the window` };
  }
  return { ok: true, sql, tables: [...tables] };
}

/* ------------------------------------------------------------------ */
/* After the rows: a fee, a volume, a price or a value in USD is never
   below zero, so a figure that is comes from a sign or a price gone
   wrong. The writer is told once which column and row. */

/** the figures that cannot be negative, by their column's name; a net, a flow, a change or a share can be */
const NEVER_NEGATIVE = /(^|_)(fees?|volumes?|usd|prices?|tvl)(_|$)/i;
const SIGNED = /(^|_)(net|flows?|inflows?|outflows?|change|delta|diff|pnl|profit|loss|gain|growth|pct|share|ratio)(_|$)/i;

/** why the rows cannot be right when a column that is never negative is, or null; Fuji's answers are not checked */
export function negativeFigure(result: { columns: readonly { name: string }[]; rows: readonly Record<string, unknown>[] }, chainId: number): string | null {
  if (isFuji(chainId)) return null;
  for (const { name } of result.columns) {
    if (!NEVER_NEGATIVE.test(name) || SIGNED.test(name)) continue;
    const i = result.rows.findIndex((r) => Number(r[name]) < 0);
    if (i >= 0)
      return `${name} is ${String(result.rows[i][name])} in row ${i + 1}, and a fee, a volume, a price or a value in USD is never below zero, so a sign in the query is wrong. Do not hide it with abs(): find the step that turns it negative. A univ3 Swap's amount0 and amount1 have opposite signs, so a price from them is -amount1 / amount0. In a DEX query, a swap's value is usd in legs, the WAVAX price of an hour is price in px, and a pair's own price is the ratio of r0 and r1 over that pair's legs only. Then call render_chart again.`;
  }
  return null;
}

/* ------------------------------------------------------------------ */
/* A relative window ("today", "this week") written as a date reads the
   same days on every later run of a kept answer. A date the question
   names stays a date. */

/** a question that names a date, a month or a year, whose days the query may write out */
const NAMED_DATE = /\b(\d{4}-\d{2}-\d{2}|\d{1,2}\/\d{1,2}(?:\/\d{2,4})?|20\d{2}|jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\b/i;
const DAY = 86_400_000;

/** why a query that writes out a date of the last five weeks must use now(), when its question (and the turns before it) name no date; or null */
export function literalWindow(sql: string, question: string, chainId: number, now = new Date()): string | null {
  if (isFuji(chainId) || NAMED_DATE.test(question)) return null;
  const recent = [...sql.matchAll(/'(\d{4}-\d{2}-\d{2})(?:[ T][\d:.]*)?'/g)].map((m) => m[1]).find((d) => Math.abs(now.getTime() - Date.parse(`${d}T00:00:00Z`)) < 35 * DAY);
  return recent
    ? `the query writes the date ${recent} out, and the question names no date. Write its window with now(): today is toStartOfDay(now()), this week toMonday(now()), this month toStartOfMonth(now()), the last 7 days now() - INTERVAL 7 DAY. A kept answer runs again on later days, and a date written out would read the same days. Then call render_chart again.`
    : null;
}
