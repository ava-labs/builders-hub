/* What a query's SQL says of a column it names: the expression behind
   its alias, and whether a distinct count makes it. The reading's
   figures (visual.ts) read both. */

/** the expression a query gives a name (AS name), back to the comma, bracket or SELECT before it; null when none */
export function exprOf(sql: string, name: string): string | null {
  const m = new RegExp(String.raw`\bAS\s+\`?${name.replace(/[^\w]/g, "")}\`?(?!\w)`, "i").exec(sql);
  if (!m) return null;
  let depth = 0;
  for (let i = m.index - 1; i >= 0; i--) {
    const ch = sql[i];
    if (ch === ")") depth++;
    else if (ch === "(") {
      if (depth === 0) return sql.slice(i + 1, m.index).trim();
      depth--;
    } else if (depth === 0 && (ch === "," || /\bSELECT\s$/i.test(sql.slice(Math.max(0, i - 7), i + 1)))) return sql.slice(i + 1, m.index).trim();
  }
  return sql.slice(0, m.index).trim();
}

const UNIQ_CALL = /\b(?:uniq\w*|countDistinct)\s*\(|\bcount\s*\(\s*DISTINCT\b/gi;
const ID_ONLY = /\(\s*(?:DISTINCT\s+)?`?(?:transaction_hash|tx_hash|hash|block_number|block_hash)`?\s*\)$/i;

/** the aliases a uniq call or a count(DISTINCT ...) makes in the SQL: the call's own parentheses, then AS */
export function uniqAliases(sql: string): Set<string> {
  const out = new Set<string>();
  for (const m of sql.matchAll(UNIQ_CALL)) {
    let i = sql.indexOf("(", m.index);
    let depth = 0;
    let quoted = false;
    for (; i < sql.length; i++) {
      const ch = sql[i];
      if (ch === "'" && sql[i - 1] !== "\\") quoted = !quoted;
      else if (!quoted && ch === "(") depth++;
      else if (!quoted && ch === ")" && --depth === 0) break;
    }
    const as = /^\s+AS\s+`?([A-Za-z_]\w*)`?/i.exec(sql.slice(i + 1));
    // a count of distinct transactions or blocks adds up: each is in one row of a time series
    if (as && !ID_ONLY.test(sql.slice(m.index, i + 1))) out.add(as[1]);
  }
  return out;
}
