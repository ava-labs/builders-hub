/* The gate every model-written query passes before ClickHouse sees it.
   One SELECT, over the raw tables and our reference tables only, on one
   chain, capped in rows. The guard is the safety boundary; the prompt is
   only advice. A reference table's rows are spliced in after this gate
   (sources.ts), so what the gate reads is what the model wrote. */

import { EVM_TABLES, targetOf } from "./target";

/** the EVM chains' tables; each target carries its own list (target.ts) */
export const ALLOWED_TABLES = EVM_TABLES;
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

export function guardSql(raw: string, chainId: number): GuardResult {
  const target = targetOf(chainId);
  let sql = String(raw ?? "").trim().replace(/;+\s*$/, "").trim();
  if (!sql) return { ok: false, error: "empty query" };
  if (sql.length > 6000) return { ok: false, error: "query too long (6000 chars max)" };
  if (sql.includes(";")) return { ok: false, error: "one statement only; no semicolons" };
  if (/--|\/\*|\*\//.test(sql)) return { ok: false, error: "no comments in the query" };
  // the DEX chapter's shorthand (prompt.ts) stands for text the query must carry
  if (/\$(DEX|POOLS|START|PROTOCOL)\b/.test(sql)) return { ok: false, error: "write the DEX WITH out in full: $DEX, $POOLS, $START and $PROTOCOL stand for its text" };
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
  // ORDER BY t WITH FILL FROM <expr> names a value, not a table
  const refs = sql.matchAll(/(?<!\bFILL\s+)\b(?:FROM|JOIN)\s+(?!\()([`"]?)([A-Za-z_][\w.]*)\1/gi);
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
  if (tables.size === 0) return { ok: false, error: `the query reads no table; use ${readable.join(", ")}` };
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
