/* The gate every model-written query passes before ClickHouse sees it.
   One SELECT, over the raw tables and our reference tables only, on one
   chain, capped in rows. The guard is the safety boundary; the prompt is
   only advice. The shorthand a DEX query opens with is written out
   first (macros.ts), so the gate reads the whole text. After this gate,
   the server defines each table the query names as its chain's rows, and
   splices in a reference table's rows (sources.ts); the gate makes sure
   the query reads no table past those definitions. */

import { FAMILY_EVENTS, familyHex } from "./families";
import { LENDING_EVENTS, strayHex, typedLending } from "./lending";
import { expandMacros } from "./macros";
import { DEX_TOPICS } from "./protocols";
import { NETWORK_ID, isFuji, targetOf } from "./target";
import { DAY } from "./values";

export type AllowedTable = string;

/** the most rows one answer may carry back to the browser */
export const MAX_ROWS = 2000;
/** the most a query may take with its shorthand written out: the query service takes 16 KiB (SQL_BUDGET in
    sources.ts), and the reference tables and names a query reads take up to about 4 KB of it */
export const QUERY_CHARS = 12000;
/** a hash prefix as the writer is told to write it: a range on the bytes, which a table sorted by the hash reads as a window */
export const HASH_RANGE =
  "hash >= unhex('12') AND hash < unhex('13') for 0x12; an odd number of digits pads both ends, so 0x123 is hash >= unhex('1230') AND hash < unhex('1240')";
/* startsWith on a hash or a topic in a filter reads a sort key's index wrong: over 7 days of raw_txs,
   startsWith(hash, unhex('12')) kept 3,781 of the 13,452 rows its range keeps */
const STARTS_WITH_KEY = /\bstartsWith\s*\(\s*(?:\w+\.)?(?:hash|tx_hash|transaction_hash|topic[0-3])\s*,/i;
/** the hash each wide table sorts by after chain_id: a range on it bounds a read as a window does */
const KEYED_BY: Record<string, string> = { raw_txs: "hash", raw_traces: "tx_hash" };
const keyRange = (sql: string, table: string) => {
  const col = KEYED_BY[table];
  return !!col && new RegExp(`\\b${col}\\s*>=?\\s*unhex\\s*\\(`, "i").test(sql) && new RegExp(`\\b${col}\\s*<=?\\s*unhex\\s*\\(`, "i").test(sql);
};

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

/** each SELECT's list, split at its own commas: the token indexes of each item, by SELECT */
function selectLists(toks: Token[]): Map<number, number[][]> {
  const lists = new Map<number, number[][]>();
  for (const s of new Set(toks.map((t) => t.select))) {
    const at = toks.flatMap((t, i) => (t.select === s ? [i] : []));
    const start = at.find((i) => toks[i].depth === 0 && keyword(toks[i], "SELECT"));
    if (start === undefined) continue;
    const end = at.find((i) => i > start && toks[i].depth === 0 && keyword(toks[i], "FROM")) ?? toks.length;
    let item: number[] = [];
    const items: number[][] = [];
    for (let i = start + 1; i < end; i++) {
      if (toks[i].select === s && toks[i].depth === 0 && toks[i].v === ",") {
        items.push(item);
        item = [];
      } else item.push(i);
    }
    items.push(item);
    lists.set(s, items);
  }
  return lists;
}

/** an alias's last two tokens of its own SELECT: AS and the name, when the item has them */
function aliasOf(toks: Token[], it: number[], s: number): { as: number; name: Token } | null {
  const own = it.filter((i) => toks[i].select === s && toks[i].depth === 0);
  const [as, name] = own.slice(-2).map((i) => toks[i]);
  return keyword(as, "AS") && name?.word ? { as: own[own.length - 2], name } : null;
}

/** the aliases that name an expression over the column they are named after ("hex(l.topic0) AS topic0"); a column under its own name is not one */
function selfAliases(toks: Token[]): { name: string; select: number }[] {
  const found: { name: string; select: number }[] = [];
  for (const [s, items] of selectLists(toks)) {
    for (const it of items) {
      const alias = aliasOf(toks, it, s);
      if (!alias) continue;
      const { name } = alias;
      const expr = it.slice(0, it.indexOf(alias.as)).filter((i) => toks[i].select === s);
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

/** whether a name says it is about the rows a LIMIT keeps: top10_share is top, 10, share; top_level is a trace's depth */
function namesTop(name: string): boolean {
  const w = name.toLowerCase().split(/_+|(?<=[a-z])(?=\d)|(?<=\d)(?=[a-z])/);
  return w.some((x, i) => (x === "top" && w[i + 1] !== "level") || x === "shown" || x === "listed");
}

/** why a column named for the rows a LIMIT keeps is a window over every group, or null: a window runs before the
    LIMIT, so sum(x) OVER () adds up all the groups the query makes, not the top rows it returns */
function windowedTop(sql: string): string | null {
  const toks = tokenize(sql);
  for (const [s, items] of selectLists(toks)) {
    if (!toks.some((t, i) => t.select === s && t.depth === 0 && keyword(t, "LIMIT") && /^\d+$/.test(toks[i + 1]?.v ?? ""))) continue;
    for (const it of items) {
      const alias = aliasOf(toks, it, s);
      if (!alias || !namesTop(alias.name.v)) continue;
      if (it.some((i) => keyword(toks[i], "OVER") && toks[i + 1]?.v === "(" && toks[i + 2]?.v === ")"))
        return `${alias.name.v} is a window over every group: OVER () runs before the LIMIT, so it adds up all the groups the query makes, not the rows the LIMIT keeps. The page adds up the rows it shows, so leave that total out, or write it in an outer SELECT over the limited rows`;
    }
  }
  return null;
}

/* ------------------------------------------------------------------ */
/* A query reads tables by the names after its FROMs and JOINs, and the
   server defines each of those as one chain's rows (sources.ts). Every
   other place a name reads a table is checked too: the name after a
   comma in a FROM is checked as a JOIN's is; parentheses after a FROM or
   a JOIN must hold a SELECT; a name on the right of an IN, and a
   function that reads a dictionary or a Join table by its name, are
   refused. */

/** the words that end a SELECT's FROM */
const FROM_END = ["WHERE", "PREWHERE", "GROUP", "ORDER", "HAVING", "LIMIT", "WINDOW", "QUALIFY", "UNION", "EXCEPT", "INTERSECT", "SETTINGS", "FORMAT"];
/** the words a join opens with; each ends the list an ARRAY JOIN or a USING with no parentheses holds */
const JOIN_WORDS = ["JOIN", "INNER", "LEFT", "RIGHT", "FULL", "CROSS", "ASOF", "ANY", "ALL", "SEMI", "ANTI", "GLOBAL", "PASTE", "ARRAY"];
const NAMED_READS = /\b(joinGet\w*|dict(?:Get\w*|Has|IsIn))\s*\(/i;

/** the names a comma in a FROM joins, each as written (db.table stays whole); or why a query reads a table in a way
    the guard cannot check. ctes holds the names the query's own WITHs define, in lower case */
function commaReads(sql: string, ctes: Set<string>): { ok: true; names: string[] } | { ok: false; error: string } {
  const fn = NAMED_READS.exec(sql);
  if (fn) return { ok: false, error: `${fn[1]}() reads a table by its name, which Query does not allow` };
  const toks = tokenize(sql);
  // the name at i, and a database name before a dot with it; null when no name stands there
  const nameAt = (i: number) => (toks[i]?.word ? (toks[i + 1]?.v === "." && toks[i + 2]?.word ? `${toks[i].v}.${toks[i + 2].v}` : toks[i].v) : null);
  // parentheses after FROM, JOIN or a comma hold a subquery, never a table
  const bareParens = (i: number) => toks[i]?.v === "(" && !/^(SELECT|WITH)$/i.test(toks[i + 1]?.v ?? "");
  const names: string[] = [];
  const froms = new Set<number>();
  for (let i = 0; i < toks.length; i++) {
    const t = toks[i];
    // x IN name reads the table of that name: only a WITH of the query's own may stand there
    const after = nameAt(i + 1);
    if (keyword(t, "IN") && after && toks[i + 2]?.v !== "(" && !ctes.has(after.toLowerCase()))
      return { ok: false, error: `IN ${after} reads a table by its name: write IN (SELECT …) over the tables here, or has(array, x) for an array` };
    if (t.depth !== 0 || !keyword(t, "FROM", "JOIN") || keyword(toks[i - 1], "FILL", "ARRAY")) continue;
    if (bareParens(i + 1)) return { ok: false, error: `${t.v.toUpperCase()} ( holds a subquery (SELECT …), never a table: name the table without parentheses` };
    // the rest of a SELECT's FROM: a comma there joins what follows it
    if (!keyword(t, "FROM") || froms.has(t.select)) continue;
    froms.add(t.select);
    // list: in an ARRAY JOIN's or a USING's list; nest: inside an array's or a map's brackets, which hold no table
    let list = false;
    let nest = 0;
    for (let j = i + 1; j < toks.length; j++) {
      const u = toks[j];
      if (u.select < t.select) break;
      if (u.select !== t.select || u.depth !== 0) continue;
      if (keyword(u, ...FROM_END)) break;
      if (u.v === "[" || u.v === "{") nest++;
      else if (u.v === "]" || u.v === "}") nest--;
      else if (keyword(u, ...JOIN_WORDS)) list = keyword(u, "ARRAY") || (keyword(u, "JOIN") && keyword(toks[j - 1], "ARRAY"));
      else if (keyword(u, "USING")) list = toks[j + 1]?.v !== "(";
      else if (u.v === "," && !list && nest === 0) {
        if (bareParens(j + 1)) return { ok: false, error: "a comma in FROM joins a subquery (SELECT …) or a table, never a table in parentheses" };
        const name = nameAt(j + 1);
        if (name) names.push(name);
      }
    }
  }
  return { ok: true, names };
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

/** the Swap topics legs is made from, WOOFi's WooSwap with them, by the names the DEX WITH gives them or as literals */
const LEGS_SWAPS = new RegExp(`\\b(v2_swap|v3_swap|lb_swap|v4_swap|woo_swap)\\b|unhex\\s*\\(\\s*'(${[DEX_TOPICS.v2Swap, DEX_TOPICS.v3Swap, DEX_TOPICS.lbSwap, DEX_TOPICS.v4Swap, DEX_TOPICS.wooSwap].join("|")})'\\s*\\)`, "i");
const LEGS_HAS = "legs has pool, block_time, block_number, tx (the log's transaction_hash), trader (its tx_from), router (its tx_to), protocol, version, t0, t1, k, r0, r1 and usd: read them FROM legs alone";

/** why the query after the $DEX shorthand reads raw_logs where legs holds the rows, or null. A read of another event (a
    Transfer or a Sync) passes, and so does a filter by its transactions or pools */
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
  const typed = isFuji(chainId) ? null : (badHex(sql) ?? strayHex(sql, chainId, FAMILY_EVENTS) ?? familyHex(sql, chainId, LENDING_EVENTS));
  if (typed) return { ok: false, error: typed };
  // the shorthand is written out before any check, and the length counts the whole text
  const x = expandMacros(sql, chainId);
  if (!x.ok) return x;
  sql = x.sql;
  // what the writer typed after $DEX reads the Swap logs from legs, never from raw_logs a second time
  const again = x.macro?.name === "DEX" ? legsAgain(sql.slice(x.macro.size)) : null;
  if (again) return { ok: false, error: again };
  if (sql.length > QUERY_CHARS) {
    const m = x.macro;
    return { ok: false, error: m ? `query too long: ${sql.length} characters with $${m.name} written out, ${QUERY_CHARS} at most. Its WITH takes ${m.size}, so what follows it may take ${QUERY_CHARS - m.size}` : `query too long (${QUERY_CHARS} chars max)` };
  }
  if (sql.includes(";")) return { ok: false, error: "one statement only; no semicolons" };
  if (/--|\/\*|\*\//.test(sql)) return { ok: false, error: "no comments in the query" };
  // the shorthand stands for text on the mainnet C-Chain only; elsewhere a query writes its WITH out
  if (/\$(DEX|POOLS|START|PROTOCOL)\b/.test(sql)) return { ok: false, error: "write the DEX WITH out in full: $DEX, $POOLS, $START and $PROTOCOL stand for its text" };
  // hashes, addresses and topics are bytes already: unhex reads each of their bytes as a hex digit
  if (!isFuji(chainId) && /\bhex\s*\(\s*unhex\s*\(/i.test(sql)) return { ok: false, error: "hex(unhex(x)) garbles x: hashes, addresses and topics are bytes already, so write lower(concat('0x', hex(x)))" };
  if (!isFuji(chainId) && STARTS_WITH_KEY.test(sql))
    return { ok: false, error: `startsWith on a hash misses rows in a filter, since ClickHouse reads the table's index wrong for it: write a prefix as a range on the bytes, ${HASH_RANGE}` };
  if (!/^(SELECT|WITH)\b/i.test(sql)) return { ok: false, error: "the query must start with SELECT or WITH" };
  const kw = sql.match(KEYWORDS);
  if (kw) return { ok: false, error: `${kw[1].toUpperCase()} is not allowed; write a plain SELECT (the server sets FORMAT and settings)` };
  const fn = sql.match(TABLE_FUNCTIONS);
  if (fn) return { ok: false, error: `table function ${fn[1]}() is not allowed` };
  if (/\bsystem\b/i.test(sql) || /\binformation_schema\b/i.test(sql)) return { ok: false, error: "system tables are not readable here" };
  // the server reads the tables that hold duplicate rows through FINAL itself (sources.ts), and
  // ClickHouse refuses a FINAL over that read, so a query's own FINAL after one of them is dropped
  if (target.final.length) sql = sql.replace(new RegExp(`\\b(${target.final.join("|")})\\b((?:\\s+(?:AS\\s+)?(?!FINAL\\b)[A-Za-z_]\\w*)?)\\s+FINAL\\b`, "gi"), "$1$2");
  // quantile and median read a random sample of 8192 values, so each run of a question gives another figure (up to 3%
  // off the exact median of an hour's transactions); the exact functions hold a day's values in a few MB
  if (!isFuji(chainId)) sql = sql.replace(/\b(quantiles?|median)(If)?\s*\(/g, (_m, f: string, c?: string) => `${f}Exact${c ?? ""}(`);

  // every table read must be one of the raw tables, or a reference table our server builds (sources.ts)
  // names a WITH defines (WITH snaps AS (…)) are the query's own, not tables
  const ctes = new Set([...sql.matchAll(/(?:\bWITH|,)\s*([A-Za-z_]\w*)\s+AS\s*\(/gi)].map((m) => m[1].toLowerCase()));
  // a WITH may not take the name of a table the server defines, and it defines every table
  const taken = [...target.tables, ...target.refs].find((r) => ctes.has(r.toLowerCase()));
  if (taken) return { ok: false, error: `${taken} is a table here; give the WITH another name` };
  const commas = commaReads(sql, ctes);
  if (!commas.ok) return commas;
  const readable = [...target.tables, ...target.refs];
  const tables = new Set<AllowedTable>();
  // ORDER BY t WITH FILL FROM <expr> names a value, not a table, and so does ARRAY JOIN <array>
  const refs = [...sql.matchAll(/(?<!\bFILL\s+)(?<!\bARRAY\s+)\b(?:FROM|JOIN)\s+(?!\()([`"]?)([A-Za-z_][\w.]*)\1/gi)].map((m) => m[2]);
  for (const name of [...refs, ...commas.names]) {
    const ident = name.replace(/^default\./i, "");
    if (ctes.has(ident.toLowerCase())) continue;
    if (!readable.includes(ident)) {
      return { ok: false, error: `table ${name} is not readable here; use ${readable.join(", ")}` };
    }
    // the server's definitions answer to the bare name only: default.raw_txs would read every chain
    if (ident !== name) return { ok: false, error: `write ${ident} without a database name` };
    tables.add(ident as AllowedTable);
  }
  if (tables.size === 0) return { ok: false, error: typedLending(sql, chainId) ?? `the query reads no table; use ${readable.join(", ")}` };
  const shadow = shadowedAlias(sql);
  if (shadow) return { ok: false, error: `the alias ${shadow} hides the column ${shadow}, so its WHERE or ON reads the alias; give the alias another name` };
  const top = isFuji(chainId) ? null : windowedTop(sql);
  if (top) return { ok: false, error: top };

  // one chain, as the writer is told to write it: the server reads each table as this chain's rows whatever the
  // query writes (sources.ts), and a query that names its chain reads it by the sort key's first column itself. A
  // network query names the chains it reads, or none: the server reads each table as the network's chains alone
  if (chainId !== NETWORK_ID) {
    const chainRe = new RegExp(`\\bchain_id\\s*(=|==)\\s*${chainId}\\b`);
    if (!chainRe.test(sql)) return { ok: false, error: `filter every table on chain_id = ${chainId}` };
    const otherChain = sql.match(/\bchain_id\s*(=|==)\s*(\d+)/g)?.find((s) => !new RegExp(`\\b${chainId}\\b`).test(s));
    if (otherChain) return { ok: false, error: `only chain_id = ${chainId} is readable on this page` };
  }

  // the big tables hold years; a read with no window scans all of them. A range on the hash raw_txs or raw_traces sorts
  // by reads only its share of the table, so it bounds the read too
  const wide = [...tables].filter((t) => target.wide.includes(t));
  if (wide.length && !target.bound.test(sql) && (isFuji(chainId) || !wide.every((t) => keyRange(sql, t)))) {
    return {
      ok: false,
      error:
        target.kind === "pchain"
          ? `bound ${wide.join(", ")} on its time or height (block_time, snapshot_time, created_time, block_height; for snapshots, the latest snapshot_time)`
          : `bound ${wide.join(", ")} on block_time or block_number (for example block_time >= now() - INTERVAL 1 DAY)${!isFuji(chainId) && wide.includes("raw_txs") ? `, or raw_txs on a range of its hash (${HASH_RANGE})` : ""}`,
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

/** why a query that writes out a date of the last five weeks must use now(), when its question (and the turns before it) name no date; or null */
export function literalWindow(sql: string, question: string, chainId: number, now = new Date()): string | null {
  if (isFuji(chainId) || NAMED_DATE.test(question)) return null;
  const recent = [...sql.matchAll(/'(\d{4}-\d{2}-\d{2})(?:[ T][\d:.]*)?'/g)].map((m) => m[1]).find((d) => Math.abs(now.getTime() - Date.parse(`${d}T00:00:00Z`)) < 35 * DAY);
  return recent
    ? `the query writes the date ${recent} out, and the question names no date. Write its window with now(): today is toStartOfDay(now()), this week toMonday(now()), this month toStartOfMonth(now()), the last 7 days now() - INTERVAL 7 DAY. A kept answer runs again on later days, and a date written out would read the same days. Then call render_chart again.`
    : null;
}
