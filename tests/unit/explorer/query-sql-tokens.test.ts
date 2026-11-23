import { describe, expect, it } from 'vitest';
import { errorPosition, tokenize, type SqlTokenKind } from '@/lib/explorer-query/sql-tokens';

// The SQL editor colors a copy of the text that lies under the typed text, so the tokens must join back to the text
// exactly; and it marks the line an error's message points at, in the editor's own text, not in what the server sent.

const joined = (sql: string) =>
  tokenize(sql)
    .map((t) => t.text)
    .join('');

/** the tokens that are not spaces, as "kind:text" */
const kinds = (sql: string) =>
  tokenize(sql)
    .filter((t) => t.text.trim())
    .map((t) => `${t.kind}:${t.text}`);

const kindOf = (sql: string, text: string): SqlTokenKind | undefined => tokenize(sql).find((t) => t.text === text)?.kind;

const TRICKY = [
  "SELECT 'it''s', 'a\\'b', '-- not a comment', '/* nor this */' FROM raw_txs",
  'SELECT 1 -- a comment with a quote \' and a `tick`\nFROM raw_blocks /* a block\n over two lines */ WHERE chain_id = 43114',
  'SELECT `block number`, "to", t.`from` FROM raw_txs AS t',
  '$DEX(toStartOfDay(now()), \'pharaoh\') SELECT sum(usd) FROM legs',
  'SELECT 1e18, 1.5E-3, .5, 0x1F, 0xdeadBEEF, 42, value / 1e18 FROM raw_txs',
  "SELECT 'never closed\nFROM raw_txs",
  'SELECT 1 /* never closed',
  'SELECT `never closed',
  "SELECT 'ends on a backslash\\",
  'SELECT a\t,\r\n  b  ,c;;',
  'SELECT é, 😀, #, @x, a ~ b',
  '',
];

describe('tokenize', () => {
  it('joins back to the exact text', () => {
    for (const sql of TRICKY) expect(joined(sql)).toBe(sql);
  });

  it('reads a string with a doubled or an escaped quote as one string', () => {
    expect(kinds("SELECT 'it''s', 'a\\'b'")).toEqual(['keyword:SELECT', "string:'it''s'", 'punct:,', "string:'a\\'b'"]);
  });

  it('keeps a comment mark inside a string as the string, and a quote inside a comment as the comment', () => {
    expect(kinds("SELECT '-- x' -- it's\nFROM t /* 'q' */")).toEqual(['keyword:SELECT', "string:'-- x'", "comment:-- it's", 'keyword:FROM', 'ident:t', "comment:/* 'q' */"]);
  });

  it('reads a quoted name as a name, a keyword inside it too', () => {
    expect(kinds('SELECT `from`, "select" FROM t')).toEqual(['keyword:SELECT', 'ident:`from`', 'punct:,', 'ident:"select"', 'keyword:FROM', 'ident:t']);
  });

  it('reads the Query shorthands', () => {
    for (const name of ['$DEX', '$LEND', '$LIQUIDATIONS', '$ICTT']) expect(kindOf(`${name}(now()) SELECT 1`, name)).toBe('macro');
    // a $ inside a string is text of the string
    expect(kinds("SELECT '$DEX'")).toEqual(['keyword:SELECT', "string:'$DEX'"]);
  });

  it('reads decimal, exponent and hex numbers', () => {
    expect(kinds('SELECT 1e18, 1.5E-3, .5, 0x1F, 42')).toEqual(['keyword:SELECT', 'number:1e18', 'punct:,', 'number:1.5E-3', 'punct:,', 'number:.5', 'punct:,', 'number:0x1F', 'punct:,', 'number:42']);
    // a digit inside a name belongs to the name
    expect(kindOf('SELECT topic0 FROM raw_logs', 'topic0')).toBe('ident');
  });

  it('reads keywords in any case', () => {
    for (const word of ['select', 'Select', 'SELECT', 'sElEcT']) expect(kindOf(`${word} 1`, word)).toBe('keyword');
    expect(kinds('select a from t where b is not null')).toEqual(['keyword:select', 'ident:a', 'keyword:from', 'ident:t', 'keyword:where', 'ident:b', 'keyword:is', 'keyword:not', 'keyword:null']);
  });

  it('reads a word before a parenthesis as a function, a keyword before one as a keyword', () => {
    expect(kindOf('SELECT count() FROM t', 'count')).toBe('function');
    expect(kindOf('SELECT toStartOfDay (block_time) FROM t', 'toStartOfDay')).toBe('function');
    expect(kindOf('SELECT a FROM t WHERE a IN (1, 2)', 'IN')).toBe('keyword');
    expect(kindOf('WITH x AS (SELECT 1) SELECT * FROM x', 'AS')).toBe('keyword');
  });

  it('reads a keyword that is also a function by what follows it', () => {
    expect(kindOf('SELECT left(s, 3) FROM t', 'left')).toBe('function');
    expect(kindOf('SELECT a FROM t LEFT JOIN u ON 1', 'LEFT')).toBe('keyword');
    expect(kindOf('SELECT any(a) FROM t', 'any')).toBe('function');
    expect(kindOf('SELECT now() - INTERVAL 1 DAY', 'DAY')).toBe('keyword');
  });

  it('joins operators of two characters', () => {
    expect(kinds('a >= 1 AND b != 2 AND c::String')).toEqual(['ident:a', 'punct:>=', 'number:1', 'keyword:AND', 'ident:b', 'punct:!=', 'number:2', 'keyword:AND', 'ident:c', 'punct:::', 'ident:String']);
  });
});

describe('errorPosition', () => {
  const SQL = 'SELECT toStartOfDay(block_time) AS t, count() AS n\nFORM raw_blocks\nWHERE chain_id = 43114 AND block_time >= now() - INTERVAL 7 DAY\nGROUP BY t';

  it('reads the line and the column of a ClickHouse syntax error', () => {
    const message = "Syntax error: failed at position 52 ('FORM') (line 2, col 1): FORM raw_blocks\nWHERE chain_id = 43114 AND block_time >= now() - INTERVAL 7 DAY\nGROUP BY t. Expected one of: token sequence, Dot, token, Comma, FROM, PREWHERE, WHERE";
    expect(errorPosition(message, SQL)).toEqual({ line: 2, col: 1 });
  });

  it('finds the failure in the typed text when the server sent the query inside its own WITH', () => {
    // the sent text has the chain's tables defined in front of it, on one line, and a LIMIT after it
    const message =
      "Syntax error: failed at position 214 ('FORM') (line 3, col 1): FORM raw_blocks\nWHERE chain_id = 43114 AND block_time >= now() - INTERVAL 7 DAY\nGROUP BY t\nLIMIT 2000\n). Expected one of: token sequence, Dot, token, Comma, FROM";
    expect(errorPosition(message, SQL)).toEqual({ line: 2, col: 1 });
  });

  it('reads a position alone, in a query of one line', () => {
    expect(errorPosition('Syntax error: failed at position 10', 'SELECT a FORM raw_blocks')).toEqual({ line: 1, col: 10 });
    expect(errorPosition("Syntax error: failed at position 10 ('FORM'): FORM raw_blocks. Expected one of: FROM, Comma", 'SELECT a FORM raw_blocks')).toEqual({ line: 1, col: 10 });
  });

  it('points at the end of the typed text when the query stops short', () => {
    const cut = 'SELECT count() FROM raw_blocks\nWHERE chain_id = 43114 AND';
    // the failure is at the LIMIT the server adds, or at the end of what it sent
    expect(errorPosition("Syntax error: failed at position 180 ('LIMIT') (line 4, col 1): LIMIT 2000\n). Expected one of: NOT, CASE", cut)).toEqual({ line: 2, col: 27 });
    expect(errorPosition('Syntax error: failed at position 190 (end of query) (line 5, col 2): . Expected one of: NOT, CASE', cut)).toEqual({ line: 2, col: 27 });
  });

  it('points at the name a ClickHouse error is about', () => {
    const sql = 'SELECT block_number,\n  blok_time\nFROM raw_blocks\nWHERE chain_id = 43114';
    expect(errorPosition("Unknown expression identifier 'blok_time' in scope SELECT block_number, blok_time FROM raw_blocks. Maybe you meant: ['block_time']", sql)).toEqual({ line: 2, col: 3 });
    expect(errorPosition('Unknown expression identifier `blok_time` in scope SELECT block_number, blok_time FROM raw_blocks', sql)).toEqual({ line: 2, col: 3 });
    expect(errorPosition("Missing columns: 'blok_time' while processing query", sql)).toEqual({ line: 2, col: 3 });
    expect(errorPosition('Unknown function toStartOfFortnight', 'SELECT\n  toStartOfFortnight(block_time)\nFROM raw_blocks')).toEqual({ line: 2, col: 3 });
  });

  it('points at the word a guard error names', () => {
    const sql = 'SELECT count()\nFROM raw_tx\nWHERE chain_id = 43114';
    expect(errorPosition('table raw_tx is not readable here; use raw_blocks, raw_txs, raw_logs, raw_traces', sql)).toEqual({ line: 2, col: 6 });
    expect(errorPosition('FORMAT is not allowed; write a plain SELECT (the server sets FORMAT and settings)', 'SELECT 1 FROM raw_blocks\nformat JSON')).toEqual({ line: 2, col: 1 });
    expect(errorPosition('table function url() is not allowed', "SELECT *\nFROM url('https://x')")).toEqual({ line: 2, col: 6 });
    expect(errorPosition('write raw_txs without a database name', 'SELECT 1\nFROM default.raw_txs')).toEqual({ line: 2, col: 14 });
    expect(errorPosition('$SWAPS is no shorthand here: open the query with $DEX(start)', '$SWAPS(now())\nSELECT 1')).toEqual({ line: 1, col: 1 });
  });

  it('is null for a message that names no place in the text', () => {
    const sql = 'SELECT count() FROM raw_txs';
    expect(errorPosition('filter every table on chain_id = 43114', sql)).toBeNull();
    expect(errorPosition('write the DEX WITH out in full: $DEX, $POOLS, $START and $PROTOCOL stand for its text', 'SELECT the FROM raw_txs')).toBeNull();
    expect(errorPosition("Unknown expression identifier 'legs' in scope WITH legs AS (SELECT 1)", sql)).toBeNull();
    // the failure is in text the server wrote, which the editor does not hold
    expect(errorPosition("Syntax error: failed at position 90 ('v9_swap') (line 1, col 90): v9_swap AS (SELECT 1). Expected one of: SELECT", sql)).toBeNull();
    expect(errorPosition('', sql)).toBeNull();
  });
});
