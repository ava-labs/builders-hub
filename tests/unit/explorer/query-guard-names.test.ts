import { describe, expect, it } from 'vitest';

import { guardSql, quotedName } from '@/lib/explorer-query/guard';

/* The guard reads a query's tokens, and ClickHouse reads its own. Where the two could differ, the guard refuses the
   text, and it knows a WITH's name only where ClickHouse does: from the WITH to the end of its parentheses, in the
   case it is written. */

const W = 'block_time >= now() - INTERVAL 1 DAY';
const BLOCKS = `SELECT 1 FROM raw_blocks WHERE chain_id = 43114 AND ${W}`;
const NOT_READABLE = /^table evm_txs is not readable here/;
const error = (sql: string, chainId = 43114) => {
  const g = guardSql(sql, chainId);
  return g.ok ? '' : g.error;
};

describe("a WITH's name", () => {
  it('stands for the WITH only after it, inside its parentheses, in its own case', () => {
    expect(error(`SELECT count() AS n FROM evm_txs WHERE 1 IN (WITH evm_txs AS (SELECT 1 AS x) ${BLOCKS})`)).toMatch(NOT_READABLE);
    expect(error(`SELECT count() AS n FROM (WITH evm_txs AS (${BLOCKS}) SELECT * FROM evm_txs) AS a, evm_txs AS b`)).toMatch(NOT_READABLE);
    expect(error(`SELECT 1 AS x FROM evm_txs UNION ALL WITH evm_txs AS (${BLOCKS}) SELECT * FROM evm_txs`)).toMatch(NOT_READABLE);
    expect(error(`WITH Evm_txs AS (${BLOCKS}) SELECT count() AS n FROM evm_txs`)).toMatch(NOT_READABLE);
    expect(error(`WITH a AS (${BLOCKS}) SELECT count() AS n FROM a WHERE 1 IN (WITH b AS (SELECT 1 AS x) SELECT x FROM b) AND 1 IN b`)).toMatch(/^IN b reads a table by its name/);
  });

  it('is not one a string spells, and a quoted one is still a name', () => {
    expect(error(`SELECT ', evm_txs AS (SELECT' AS s, count() AS n FROM evm_txs WHERE 1 IN (${BLOCKS})`)).toMatch(NOT_READABLE);
    expect(error(`WITH \`raw_logs\` AS (SELECT * FROM raw_txs WHERE chain_id = 43114 AND ${W}) SELECT count() AS n FROM raw_logs`)).toBe('raw_logs is a table here; give the WITH another name');
  });

  it('reads as before where ClickHouse knows it', () => {
    const tot = `tot AS (SELECT count() AS n FROM raw_txs WHERE chain_id = 43114 AND ${W})`;
    expect(error(`WITH ${tot} SELECT n FROM tot UNION ALL SELECT n + 1 FROM tot`)).toBe('');
    expect(error(`WITH ${tot}, more AS (SELECT n * 2 AS m FROM tot) SELECT m FROM more WHERE m IN (tot)`)).toBe('');
    expect(error(`SELECT k FROM (WITH ${tot} SELECT n AS k FROM tot) AS a`)).toBe('');
    expect(error(`WITH "my total" AS (SELECT count() AS n FROM raw_txs WHERE chain_id = 43114 AND ${W}) SELECT n AS "tx count" FROM "my total"`)).toBe('');
  });
});

describe('text ClickHouse would read another way than the guard', () => {
  it('is refused for a quoted name with a backslash, and for a function under a quoted name', () => {
    expect(error('SELECT name FROM `\\x73ystem`.`tables` WHERE 1 IN (' + BLOCKS + ')')).toBe('write the name \\x73ystem without a backslash');
    expect(error('SELECT * FROM `\\x75rl`(\'http://localhost/\', \'CSV\', \'a String\') WHERE 1 IN (' + BLOCKS + ')')).toBe('write the name \\x75rl without a backslash');
    expect(error(`SELECT count() AS n FROM raw_blocks WHERE chain_id = 43114 AND ${W} AND 1 IN \`numbers\`(3)`)).toBe('write the function numbers without quotes');
  });

  it('is refused for a name spelled with an escape inside a subquery, and for a function that reads a table by text', () => {
    const inner = 'SELECT arraySort(groupArray(name)) FROM `sys\\x74em`.tables WHERE database = currentDatabase()';
    expect(error(`SELECT currentDatabase() AS db, (${inner}) AS tables FROM raw_blocks WHERE chain_id = 43114 LIMIT 1`)).toBe('write the name sys\\x74em without a backslash');
    expect(error(`SELECT 1 AS h FROM raw_blocks WHERE chain_id = 43114 AND hasColumnInTable(concat('sys', 'tem'), 'tables', 'name') LIMIT 1`)).toBe('hasColumnInTable() reads a table by its name, which Query does not allow');
  });

  it('is refused for a character that does not show, a quote left open, a # comment and a $ outside a string', () => {
    expect(error(`SELECT count() AS n FROM​evm_txs WHERE 1 IN (${BLOCKS})`)).toBe('the query holds a character that does not show (U+200B): write plain spaces and line ends');
    expect(error(`SELECT count() AS n FROM raw_blocks WHERE chain_id = 43114 AND ${W}`)).toMatch(/U\+00A0/);
    expect(error(`SELECT '\\\n' AS a FROM raw_blocks, evm_txs WHERE chain_id = 43114 AND ${W} AND 'x' = ''`)).toMatch(NOT_READABLE);
    expect(error(`SELECT count() AS n FROM raw_blocks WHERE chain_id = 43114 AND ${W} AND miner = 'x`)).toBe('a quote is left open: close each string and each quoted name');
    expect(error(`SELECT count() AS n # '\n FROM raw_blocks, evm_txs # '\n WHERE chain_id = 43114 AND ${W}`)).toBe('no comments in the query');
    expect(error(`SELECT $$'$$ AS a FROM raw_blocks, evm_txs WHERE chain_id = 43114 AND ${W} AND $$'$$ = ''`)).toBe("$ stands in a shorthand at the query's start, or inside a string in single quotes");
  });

  it('is refused for a table read the tokens do not place: a SELECT deep in parentheses, a quoted parenthesis, IN (name)', () => {
    expect(error(`SELECT count() AS n FROM raw_blocks WHERE chain_id = 43114 AND ${W} AND 1 IN ((SELECT 1) UNION ALL SELECT 1 FROM raw_blocks, evm_txs)`)).toBe('a SELECT in parentheses stands right after the opening parenthesis: (SELECT …)');
    expect(error(`SELECT hash IN evm_txs \`(\` FROM raw_txs WHERE chain_id = 43114 AND ${W}`)).toMatch(/^IN evm_txs reads a table by its name/);
    expect(error(`SELECT count() AS n FROM raw_txs WHERE chain_id = 43114 AND ${W} AND hash IN (evm_txs)`)).toMatch(/^IN evm_txs reads a table by its name/);
    expect(error(`SELECT count() AS n FROM raw_txs WHERE chain_id = 43114 AND ${W} AND hash IN ((default.raw_logs))`)).toMatch(/^IN default\.raw_logs reads a table by its name/);
    expect(error(`SELECT count() AS n FROM 'blocks.csv' WHERE 1 IN (${BLOCKS})`)).toBe('FROM reads a table by its name, or a subquery (SELECT …)');
    expect(error(`SELECT count() AS n FROM \`evm txs\` WHERE 1 IN (${BLOCKS})`)).toBe('table evm txs is not readable here; use raw_blocks, raw_txs, raw_logs, raw_traces, dex_factories, dex_tokens, lending_markets, lending_tokens, network_upgrades');
  });

  it('is refused for an alias that is a word of the query, where the word would hide a table', () => {
    expect(error(`SELECT 1 AS fill FROM evm_txs WHERE 1 IN (${BLOCKS})`)).toMatch(NOT_READABLE);
    expect(error(`SELECT count() AS n FROM raw_blocks AS array JOIN evm_txs AS e ON 1 = 1 WHERE array.chain_id = 43114 AND array.${W}`)).toMatch(NOT_READABLE);
    expect(error(`SELECT count() AS n FROM raw_blocks AS array, evm_txs AS e WHERE array.chain_id = 43114 AND array.${W}`)).toMatch(NOT_READABLE);
    expect(error(`SELECT count() AS n FROM raw_blocks AS where, evm_txs AS e WHERE where.chain_id = 43114 AND where.${W}`)).toMatch(NOT_READABLE);
    expect(error(`SELECT count() AS n FROM raw_blocks qualify, evm_txs AS e WHERE qualify.chain_id = 43114 AND qualify.${W}`)).toBe('qualify is a word of the query here; give the alias another name');
    expect(error(`SELECT count() AS n FROM raw_blocks AS \`[\`, evm_txs AS e WHERE chain_id = 43114 AND ${W}`)).toMatch(NOT_READABLE);
    expect(error(`SELECT toDate(now()) AS d ORDER BY d WITH FILL FROM evm_txs`)).toMatch(NOT_READABLE);
  });

  it('passes WITH FILL FROM after a FROM, an ARRAY JOIN, and an alias a clause follows', () => {
    expect(error(`SELECT toDate(block_time) AS d, count() AS n FROM raw_blocks AS b WHERE chain_id = 43114 AND ${W} GROUP BY d ORDER BY d WITH FILL FROM toDate(now()) - 1 TO toDate(now()) + 1`)).toBe('');
    expect(error(`SELECT k, count() AS n FROM raw_logs AS l LEFT ARRAY JOIN [topic1, topic2] AS k WHERE chain_id = 43114 AND ${W} GROUP BY k ORDER BY n DESC, k LIMIT 1, 5`)).toBe('');
  });

  it('passes a $ or a # in a string, a quoted alias, and a list or a NULL after IN', () => {
    expect(error(`SELECT concat('$', toString(count())) AS "fees ($)", '# of blocks' AS label FROM raw_blocks WHERE chain_id = 43114 AND ${W}`)).toBe('');
    expect(error(`SELECT count() AS n FROM raw_txs WHERE chain_id = 43114 AND ${W} AND toHour(block_time) IN (1, 2) AND gas_used NOT IN (NULL) AND success IN (true)`)).toBe('');
    expect(error(`SELECT 'it\\'s' AS a, count() AS \`tx count\` FROM raw_blocks WHERE chain_id = 43114 AND ${W}`)).toBe('');
  });
});

describe('a column name the server writes into its own query', () => {
  it('cannot end its quotes', () => {
    expect(quotedName('n')).toBe('`n`');
    expect(quotedName('a`b\\')).toBe('`ab`');
  });
});
