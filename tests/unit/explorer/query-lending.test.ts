import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/sourcify', () => ({ getVerifiedContractResolvingProxies: vi.fn(async () => null) }));

import { createHash } from 'node:crypto';
import { recipeKey } from '@/lib/explorer-query/cache';
import { enrichNames, fillDrill } from '@/lib/explorer-query/enrich';
import { guardSql, shadowedAlias } from '@/lib/explorer-query/guard';
import { AAVE_ASSETS, AAVE_SLUG, LENDING_MARKETS, LENDING_NAMES, LENDING_PROTOCOLS, LENDING_TOKENS, lendingQuestion, marketsWith, namesIn, pricedNote, zeroUsd } from '@/lib/explorer-query/lending';
import { collapseMacros, expandMacros } from '@/lib/explorer-query/macros';
import { dexQuestion, promptVersion, systemPrompt } from '@/lib/explorer-query/prompt';
import { namedIn, oneProtocol, protocolScope, unitName } from '@/lib/explorer-query/checks';
import { SQL_BUDGET, withSources } from '@/lib/explorer-query/sources';

/** the query service's screen (stats-api query.go, forbiddenRe): one of these words, then a space or "(" */
const SCREEN = /\b(insert|alter|drop|create|attach|detach|truncate|optimize|rename|grant|revoke|kill|system|use|set|into\s+outfile|settings|url|s3|s3cluster|remote|remotesecure|file|mysql|postgresql|mongodb|jdbc|odbc|hdfs|azureblobstorage|iceberg|deltalake|hudi|input|executable|cluster|clusterallreplicas|dictionary|merge|view|values|format|numbers|zeros|generaterandom|null|loop)[\s(]/i;
const LENDING = [
  'Deposits and borrows per day per protocol this week',
  'Who are the largest borrowers on Aave right now?',
  'Who are the largest borrowers on Benqi right now?',
  'Liquidations this week: who was liquidated and for how much?',
  'Net flow per asset this week',
  'What is the utilization of each lending market on Aave and Benqi?',
  'How much is supplied and borrowed on Aave and Benqi, and what is their TVL?',
  'Who are the top liquidators this month?',
  'How much was flash-borrowed on Aave this week?',
  'What are the supply and borrow rates on Aave right now?',
  'How many unique borrowers does each protocol have per week?',
  'What were the largest deposits today?',
];
const OTHERS = [
  'What is the volume per DEX today?',
  'Pharaoh volume per day this week',
  'Top pools by swaps on Trader Joe today',
  'Who are the top LPs of the Uniswap v3 WAVAX/USDC pool?',
  'The largest swaps today',
  'Which DEX has the most unique traders this week?',
  'WAVAX price on each DEX in the last hour',
  'USDC transfers per 5 minutes, count and volume',
  'Busiest senders in the last hour',
  'Most called methods',
  'Fees burned per 5 minutes',
  'Where did USDC go yesterday?',
  'Active addresses per day this week',
];
const today = 'toStartOfDay(now())';
const hex = (i: number, fill: string) => `0x${i.toString(16).padStart(40, fill)}`;
const BENQI = Object.keys(LENDING_PROTOCOLS).find((s) => s !== AAVE_SLUG)!;
const ask = (lending: boolean) => systemPrompt({ chainId: 43114, chainName: 'Avalanche C-Chain', symbol: 'AVAX', schema: '', coverage: null, lending });

describe('the lending tables', () => {
  it('hold Benqi core markets with their asset, decimals and price, and every asset Aave lends', () => {
    const core = LENDING_MARKETS.filter((m) => m.version === 'core');
    expect(core.length).toBeGreaterThanOrEqual(15);
    for (const m of core) expect(LENDING_TOKENS.some((t) => t.token === m.asset)).toBe(true);
    expect(new Set(LENDING_MARKETS.map((m) => m.market)).size).toBe(LENDING_MARKETS.length);
    expect(AAVE_ASSETS.length).toBeGreaterThanOrEqual(15);
    expect(Object.keys(LENDING_PROTOCOLS).sort()).toEqual([AAVE_SLUG, BENQI].sort());
  });

  it('define only the names a query reads and does not define itself', () => {
    expect(namesIn('SELECT count() FROM raw_logs WHERE topic0 = supply_t AND address = aave_pool').map((n) => n.split(' AS ')[1]).sort()).toEqual(['aave_pool', 'supply_t']);
    // the DEX WITH names v2_swap itself, so the server leaves it out
    expect(namesIn("WITH unhex('d78a') AS v2_swap SELECT 1 FROM raw_logs WHERE topic0 = v2_swap")).toEqual([]);
    for (const [name, value] of Object.entries(LENDING_NAMES)) expect(value).toMatch(name === 'price_pools' ? /^\[unhex\('[0-9a-f]{40}'\)(, unhex\('[0-9a-f]{40}'\)){6}\]$/ : /^unhex\('([0-9a-f]{40}|[0-9a-f]{64})'\)$/);
  });
});

describe('a lending question', () => {
  it('is one that names Aave, Benqi or a lending word, on the mainnet C-Chain only', () => {
    for (const q of LENDING) expect(lendingQuestion(43114, q), q).toBe(true);
    for (const q of OTHERS) expect(lendingQuestion(43114, q), q).toBe(false);
    for (const q of LENDING) expect(dexQuestion(43114, q), q).toBe(false);
    expect(lendingQuestion(43113, LENDING[1])).toBe(false);
    expect(lendingQuestion(432204, LENDING[1])).toBe(false);
    expect(lendingQuestion(1, LENDING[1])).toBe(false);
    // a follow-up keeps it when an earlier turn read the lending tables
    expect(lendingQuestion(43114, 'make it weekly', [{ prompt: 'what is this', sql: 'SELECT count() FROM lending_markets WHERE chain_id = 43114' }])).toBe(true);
  });

  it('gets the lending chapter, and every other prompt stays as it was', () => {
    const plain = ask(false);
    const lending = ask(true);
    expect(plain).not.toContain('## Lending');
    expect(lending).toContain('## Lending');
    expect(lending.startsWith(plain.slice(0, plain.indexOf('## Query rules')))).toBe(true);
    expect(promptVersion(43114, false, true)).not.toBe(promptVersion(43114));
    expect(promptVersion(43114, true, false)).toBe(promptVersion(43114, true));
    for (const chainId of [43113, 432204]) expect(systemPrompt({ chainId, chainName: 'x', symbol: 'AVAX', schema: '', coverage: null, lending: true })).not.toContain('## Lending');
    const key = (version: string, q: string) => createHash('sha256').update(`43114\n${version}\n${q}\n`).digest('hex').slice(0, 32);
    expect(recipeKey(43114, 'Who are the largest borrowers on Aave right now?')).toBe(key(promptVersion(43114, false, true), 'who are the largest borrowers on aave right now'));
  });
});

describe('the lending shorthand', () => {
  const refused = (sql: string) => {
    const x = expandMacros(sql, 43114);
    return x.ok ? '' : x.error;
  };

  it('writes each WITH out, ending in the table the chapter names', () => {
    const ends: [string, string][] = [
      [`$LEND(${today})`, 'actions AS (SELECT e.*,'],
      [`$LEND(${today}, '${BENQI}')`, 'actions AS (SELECT e.*,'],
      [`$LIQUIDATIONS(${today})`, 'liquidations AS (SELECT lq.*,'],
      [`$DEBTS('${AAVE_SLUG}')`, 'debts AS (SELECT'],
      [`$DEBTS('${BENQI}')`, 'debts AS (SELECT'],
      [`$MARKETS('${AAVE_SLUG}')`, 'markets AS (SELECT'],
      [`$MARKETS('${BENQI}')`, 'markets AS (SELECT'],
      [`$PRICES(${today})`, 'lpx AS (SELECT'],
    ];
    for (const [call, end] of ends) {
      const x = expandMacros(`${call} SELECT count() AS n FROM raw_logs WHERE chain_id = 43114 AND block_time >= now() - INTERVAL 1 HOUR`, 43114);
      expect(x.ok && x.sql.startsWith('WITH ') && x.sql.includes(end), call).toBe(true);
    }
    // one protocol reads that protocol's logs only
    const aave = expandMacros(`$LEND(${today}, '${AAVE_SLUG}') SELECT count() AS n FROM actions`, 43114);
    expect(aave.ok && !aave.sql.includes('qi_mint_t') && aave.sql.includes('supply_t')).toBe(true);
  });

  it('takes one protocol for debts and markets, and refuses a slug it has no protocol for', () => {
    expect(refused('$DEBTS() SELECT 1 FROM debts')).toMatch(/^\$DEBTS covers one protocol at a time: \$DEBTS\('/);
    expect(refused('$MARKETS() SELECT 1 FROM markets')).toMatch(/^\$MARKETS covers one protocol at a time/);
    expect(refused(`$LEND(${today}, 'pharaoh') SELECT 1 FROM actions`)).toMatch(/^'pharaoh' is not a protocol's slug; the slugs are /);
    expect(refused(`$DEX(${today}, '${BENQI}') SELECT 1 FROM legs`)).toMatch(/^'benqi' is not a protocol's slug/);
    expect(refused(`$PRICES(${today}, '${BENQI}') SELECT 1 FROM lpx`)).toMatch(/^\$PRICES takes no slug: /);
    expect(refused(`$LIQUIDATIONS('${BENQI}') SELECT 1 FROM liquidations`)).toMatch(/^\$LIQUIDATIONS takes the window's start first, then the slug/);
  });

  it("stops a window at its end, and values each action at the hour's price, sAVAX's by its stake rate", () => {
    const end = 'toStartOfDay(now())';
    const start = `${end} - INTERVAL 1 DAY`;
    const lend = expandMacros(`$LEND(${start}, ${end}, '${AAVE_SLUG}') SELECT count() AS n FROM actions`, 43114);
    expect(lend.ok && lend.sql.includes(`a.block_time >= ${start} AND a.block_time < ${end} AND a.address = aave_pool`)).toBe(true);
    const both = expandMacros(`$LEND(${start}, ${end}) SELECT count() AS n FROM actions`, 43114);
    expect(both.ok && both.sql.includes(`l.block_time >= ${start} AND l.block_time < ${end} AND l.topic0 IN`)).toBe(true);
    expect(both.ok && both.sql).toContain(`block_time >= toStartOfHour(toDateTime(${start})) - INTERVAL 1 DAY AND block_time < ${end} AND has(price_pools, address)`);
    expect(both.ok && both.sql).toContain('ASOF LEFT JOIN lp AS r ON e.kind = r.k AND e.t >= r.d LEFT JOIN lpx AS x ON toStartOfHour(e.t) = x.d');
    expect(both.ok && both.sql).toContain("'savax', ifNotFinite(quantileExactIf(0.5)(q, p = 7), NULL)");
    const liq = expandMacros(`$LIQUIDATIONS(${start}, ${end}) SELECT count() AS n FROM liquidations`, 43114);
    expect(liq.ok && liq.sql.split(`block_time < ${end}`).length - 1).toBe(2);
    const px = expandMacros(`$PRICES(${start}, ${end}) SELECT d FROM lpx`, 43114);
    expect(px.ok && px.sql).toContain(`block_time >= toDate(${start}) AND block_time < ${end} AND has(price_pools, address)`);
  });

  it("reads Aave's reserve tokens in the type of raw_logs.address, so a token that ends in a zero byte matches its logs", () => {
    // aAvaUSDe ends in 00: as a String, joined to the FixedString address, it lost the zero and matched no Mint or Burn
    for (const call of [`$MARKETS('${AAVE_SLUG}')`, `$DEBTS('${AAVE_SLUG}')`]) {
      const x = expandMacros(`${call} SELECT count() AS n FROM raw_logs WHERE chain_id = 43114 AND block_time >= now() - INTERVAL 1 HOUR`, 43114);
      expect(x.ok && x.sql, call).toContain('toFixedString(substring(data, 45, 20), 20)');
    }
    expect(marketsWith(AAVE_SLUG)).toContain('toFixedString(substring(topic2, 13, 20), 20), 1)');
    // Benqi's markets too, in every WITH that reads them, and a collateral market read from a log
    const core = "(SELECT * REPLACE (toFixedString(market, 20) AS market) FROM lending_markets WHERE chain_id = 43114 AND version = 'core')";
    for (const call of [`$LEND(${today}, '${BENQI}')`, `$LIQUIDATIONS(${today}, '${BENQI}')`, `$DEBTS('${BENQI}')`, `$MARKETS('${BENQI}')`]) {
      const x = expandMacros(`${call} SELECT count() AS n FROM raw_logs WHERE chain_id = 43114 AND block_time >= now() - INTERVAL 1 HOUR`, 43114);
      const sql = x.ok ? x.sql : '';
      expect(sql, call).toContain(core);
      expect(sql.split('lending_markets').length - 1, call).toBe(sql.split(core).length - 1);
    }
    expect(expandMacros(`$LIQUIDATIONS(${today}, '${BENQI}') SELECT 1 AS n FROM liquidations`, 43114)).toMatchObject({ sql: expect.stringContaining('ON toFixedString(substring(l.data, 109, 20), 20) = c.market') });
    // a query of its own reads lending_markets as the table sends it, a String: no listed market may end in 00
    expect(LENDING_MARKETS.filter((m) => m.market.endsWith('00'))).toEqual([]);
  });

  it("reads Benqi's reserves from its events, and both protocols' markets are too large for one query", async () => {
    expect(marketsWith(AAVE_SLUG)).toContain('greatest(supplied_usd - borrowed_usd, 0) AS tvl_usd');
    const benqi = marketsWith(BENQI);
    for (const t of ['reserves_added_t', 'reserves_reduced_t', 'reserve_factor_t', 'accrue_t']) expect(benqi).toContain(t);
    const both = guardSql(`${marketsWith()} SELECT protocol, supplied_usd FROM markets`, 43114);
    if (both.ok) await expect(withSources(both.sql, 43114)).rejects.toThrow(/too long to send/);
    else expect(both.error).toMatch(/^query too long/);
  });
});

describe('the lending worked examples', () => {
  const prompt = ask(true);
  const chapter = prompt.slice(prompt.indexOf("Each protocol's deposits and borrows per day"), prompt.indexOf('The 15 token contracts with the most transfers'));
  const lines = chapter.split('\n');
  const example = (l: string) => /^\$(LEND|DEBTS|LIQUIDATIONS|MARKETS|PRICES)\(/.test(l);
  const row = { day: '2026-09-27', hour: '2026-09-27 10:00:00', protocol: AAVE_SLUG, borrower_address: hex(1, 'a'), token: AAVE_ASSETS[0].token };

  it('are eight, at least one for each shorthand, and each group opens into its records', () => {
    expect(lines.filter(example).map((l) => /^\$(\w+)/.exec(l)![1])).toEqual(['LEND', 'LEND', 'LEND', 'DEBTS', 'LIQUIDATIONS', 'MARKETS', 'LEND', 'PRICES']);
    expect(lines.filter((l) => l.startsWith('drill: '))).toHaveLength(5);
  });

  it('name no expression after a column, pass the guard, fit the query service with the tables, and pass its screen', async () => {
    const sqls = lines.flatMap((l) => {
      if (example(l)) return [l];
      if (!l.startsWith('drill: ')) return [];
      const d = fillDrill(l.slice(7), row);
      return d.ok ? [d.sql] : [`not filled: ${d.error}`];
    });
    expect(sqls).toHaveLength(13);
    for (const sql of sqls) {
      const g = guardSql(sql, 43114);
      expect(g.ok ? '' : `${g.error}: ${sql.slice(0, 80)}`).toBe('');
      if (!g.ok) continue;
      expect(shadowedAlias(g.sql, true), sql.slice(0, 80)).toBeNull();
      const out = await withSources(g.sql, 43114);
      expect(Buffer.byteLength(out.sql)).toBeLessThanOrEqual(SQL_BUDGET);
      expect(SCREEN.test(out.sql), sql.slice(0, 80)).toBe(false);
      expect(unitName(sql, 43114), sql.slice(0, 80)).toBeNull();
    }
  });
});

describe('a hex literal typed wrong', () => {
  const pool = "unhex('794a61358d6845594f94dc1db02a252b5b4814ad')";
  const stray = "unhex('0bcc1e4a8a8f67e4518408a4438db1152b8b67e66d749fac196a92db5fbbda7a')";
  const q = (address: string, topic: string, chainId = 43114) =>
    `SELECT count() AS n FROM raw_logs WHERE chain_id = ${chainId} AND block_time >= toMonday(now()) AND address = ${address} AND topic0 = ${topic}`;
  const refused = (sql: string, chainId = 43114) => {
    const g = guardSql(sql, chainId);
    return g.ok ? '' : g.error;
  };

  it('is refused with its reason: a digit short or over, a 0x, a letter past f', () => {
    // L09's tests wrote Aave's Pool with 39 and 41 digits, which unhex pads or cuts into another address
    expect(refused(q("unhex('794a61358D6845594f94dc1DB02A252b5b4D56E')", 'flash_loan_t'))).toBe("unhex('794a6135…b4D56E') has 39 hex digits, so it matches nothing: an address has 40, a topic or a hash 64");
    expect(refused(q("unhex('794a61358d6845594f94dc1db02a252b5b4d56e7d')", 'flash_loan_t'))).toMatch(/ has 41 hex digits, /);
    expect(refused(q("unhex('0x794a61358d6845594f94dc1db02a252b5b4814ad')", 'flash_loan_t'))).toMatch(/ starts with 0x, which unhex reads as a byte/);
    expect(refused(q("unhex('794a61358d6845594f94dc1db02a252b5b4814az')", 'flash_loan_t'))).toMatch(/ has a character that is not a hex digit/);
    // an even count that is not the column's: an address has 40 digits, a topic 64 (the prompt shows a topic's first 8)
    expect(refused(q("unhex('794a61358d6845594f94dc1db02a252b5b4814')", 'flash_loan_t'))).toBe("unhex('794a6135…5b4814') has 38 hex digits, and address holds 40, so it matches nothing");
    expect(refused(q('aave_pool', "unhex('efefaba5')"))).toBe("unhex('efefaba5') has 8 hex digits, and topic0 holds 64, so it matches nothing");
    expect(refused(`SELECT count() AS n FROM raw_logs WHERE chain_id = 43114 AND block_time >= toMonday(now()) AND address = aave_pool AND topic0 IN (supply_t, unhex('efefaba5'))`)).toMatch(/ has 8 hex digits, and topic0 holds 64/);
    expect(refused("SELECT count() AS n FROM raw_logs WHERE chain_id = 43114 AND block_time >= toMonday(now()) AND substring(topic1, 13, 20) = unhex('b97ef9ef8734c71904d8002f8b6bc66dd9c48a6e')")).toBe('');
    // Fuji keeps its behavior
    expect(refused(q("unhex('794a61358D6845594f94dc1DB02A252b5b4D56E')", 'flash_loan_t', 43113), 43113)).toBe('');
  });

  it('is refused on the lending contracts when it is none of their events, or an address a few digits off one our server names', () => {
    // L09's answer: Aave's Pool right, a FlashLoan topic no log has, and "no flash loans this week"
    expect(refused(q(pool, stray))).toMatch(/^unhex\('0bcc1e4a…bbda7a'\) is no event of Aave's or Benqi's contracts: a topic written from memory is often wrong, and this one reads no rows\. Write the name our server defines for the event, as it is: .*flash_loan_t/);
    expect(refused(q('aave_pool', stray))).toMatch(/ is no event of /);
    expect(refused(`SELECT count() AS n FROM raw_logs WHERE chain_id = 43114 AND block_time >= toMonday(now()) AND address = aave_pool AND topic0 IN (supply_t, ${stray})`)).toMatch(/ is no event of /);
    expect(refused(q("unhex('794a61358d6845594f94dc1db02a252b5b4d56e7')", 'flash_loan_t'))).toBe("unhex('794a6135…4d56e7') is not Aave's Pool, whose address our server names aave_pool: write aave_pool, as it is");
    expect(refused(`$PRICES(toMonday(now())) SELECT count() AS loans FROM raw_logs WHERE chain_id = 43114 AND block_time >= toMonday(now()) AND address = unhex('794a61ebc6b034efe7fcbffe3dc06fa48aeda4e1') AND topic0 = flash_loan_t`)).toMatch(/^unhex\('794a61eb…eda4e1'\) is not Aave's Pool, whose address our server names aave_pool/);
    expect(refused(`$PRICES(toMonday(now())) SELECT count() AS loans FROM raw_logs WHERE chain_id = 43114 AND block_time >= toMonday(now()) AND topic0 = ${stray}`)).toMatch(/ is no event of /);
    // a replay of L09 read Ethereum's Pool: the Pool's events come from this chain's Pool alone, a market's from the markets
    expect(refused(q("unhex('7d2768de32b0b80b7a3454c06bdac94a69ddc7a9')", 'flash_loan_t'))).toBe("unhex('7d2768de…ddc7a9') is not Aave's Pool on this chain, which writes these events: an address from memory is often another chain's, and reads no rows. Write aave_pool, as it is");
    expect(refused(q("unhex('7d2768de32b0b80b7a3454c06bdac94a69ddc7a9')", 'qi_borrow_t'))).toMatch(/^unhex\('7d2768de…ddc7a9'\) is no Benqi market on this chain, where the markets write these events: read them from lending_markets, /);
    expect(refused(`SELECT count() AS n FROM raw_logs AS f LEFT JOIN lending_tokens AS k ON substring(f.topic2, 13, 20) = k.token WHERE f.chain_id = 43114 AND f.block_time >= toMonday(now()) AND f.address = unhex('7d2768de32b0b80b7a3454c06bdac94a69ddc7a9') AND f.topic0 = unhex('afa23caa0d01ce7b5a41e18ffbee1db3ac88dda000d4d24c76a32da3e30e67cd')`)).toMatch(/^unhex\('afa23caa…0e67cd'\) is no event of /);
    // a replay wrote its own flash_loan_t AS unhex('804c9b84'), which the server then left out
    expect(refused(`WITH unhex('efefaba5e921573100900a3ad9cf29f222d995fb3b6045797eaea7521bd8d6f0') AS flash_loan_t SELECT count() AS n FROM raw_logs WHERE chain_id = 43114 AND block_time >= toMonday(now()) AND address = aave_pool AND topic0 = flash_loan_t`)).toBe(
      'flash_loan_t is a name our server defines in front of the query; a WITH of your own may not define it. Write flash_loan_t as it is, and leave its value to the server',
    );
    // and one wrote WITH aave_pool AS (SELECT unhex('7d2768de…')), Ethereum's Pool
    expect(refused(`WITH aave_pool AS (SELECT unhex('7d2768de32b0b80b7a3454c06bdac94a69ddc7a9') AS addr) SELECT count() AS n FROM raw_logs WHERE chain_id = 43114 AND block_time >= toMonday(now()) AND address IN (SELECT addr FROM aave_pool)`)).toMatch(/^aave_pool is a name our server defines in front of the query; a WITH of your own may not define it/);
    // right hex passes: a named event, another event of the Pool, a transaction hash, and any topic off the lending contracts
    expect(refused(q(pool, "unhex('efefaba5e921573100900a3ad9cf29f222d995fb3b6045797eaea7521bd8d6f0')"))).toBe('');
    expect(refused(q('aave_pool', "unhex('00058a56ea94653cdf4f152d227ace22d4c00ad99e2a43f58cb7d9e3feb295f2')"))).toBe('');
    expect(refused(`SELECT count() AS n FROM raw_logs WHERE chain_id = 43114 AND block_time >= toMonday(now()) AND address = aave_pool AND transaction_hash = ${stray.replace('0bcc', '0bcd')}`)).toBe('');
    expect(refused(q("unhex('b97ef9ef8734c71904d8002f8b6bc66dd9c48a6e')", stray))).toBe('');
  });

  it("is held against the events of its own SELECT, so a price pool or sAVAX read by its address beside the Pool's events passes", () => {
    // qaudit: the addresses were read over the whole query, so a lending query that read the WAVAX price pool in a WITH
    // of its own was sent back as if it read the Pool's events there
    const week = 'chain_id = 43114 AND block_time >= toMonday(now())';
    const px = `px AS (SELECT toStartOfHour(block_time) AS h, count() AS swaps FROM raw_logs WHERE ${week} AND address = unhex('fae3f424a0a47706811521e3ee268f00cfb5c45e') AND topic0 = v3_swap GROUP BY h)`;
    const savax = "unhex('2b2c81e08f1af8835a78bb2a90ae924ace0ea4be')";
    const lb = "unhex('d446eb1660f766d533beceef890df7a69d26f7d1')";
    for (const sql of [
      `WITH ${px}, s AS (SELECT count() AS stakes FROM raw_logs WHERE ${week} AND address = ${savax} AND topic0 = submitted_t) SELECT toStartOfHour(block_time) AS t, count() AS supplies, any(s.stakes) AS stakes FROM raw_logs CROSS JOIN s WHERE ${week} AND address = aave_pool AND topic0 = supply_t GROUP BY t`,
      `WITH ${px} SELECT count() AS mints FROM raw_logs WHERE ${week} AND address IN (SELECT market FROM lending_markets WHERE chain_id = 43114) AND topic0 = qi_mint_t`,
      // one scan of the Pool's logs and sAVAX's, and an lb pool's Swap by its topic in a SELECT that reads no lending contract
      `SELECT countIf(topic0 = supply_t) AS supplies, countIf(topic0 = submitted_t) AS stakes FROM raw_logs WHERE ${week} AND address IN (aave_pool, ${savax}) AND topic0 IN (supply_t, submitted_t)`,
      `WITH b AS (SELECT count() AS swaps FROM raw_logs WHERE ${week} AND address = ${lb} AND topic0 = unhex('ad7d6f97abf51ce18e17a38f4d70e975be9c0708474987bb3e26ad21bd93ca70')) SELECT count() AS borrows, any(b.swaps) AS swaps FROM raw_logs CROSS JOIN b WHERE ${week} AND address = aave_pool AND topic0 = borrow_t`,
      // each side of a UNION is a SELECT of its own
      `SELECT 'swaps' AS what, count() AS n FROM raw_logs WHERE ${week} AND address = unhex('fae3f424a0a47706811521e3ee268f00cfb5c45e') AND topic0 = v3_swap UNION ALL SELECT 'supplies' AS what, count() AS n FROM raw_logs WHERE ${week} AND topic0 = supply_t`,
    ])
      expect(refused(sql), sql).toBe('');
    // the Pool's events read at another address are sent back still, by that SELECT's own literal, and so is a topic no
    // lending contract writes in a SELECT that reads the Pool
    expect(refused(`WITH ${px} SELECT count() AS loans FROM raw_logs WHERE ${week} AND address = unhex('7d2768de32b0b80b7a3454c06bdac94a69ddc7a9') AND topic0 = flash_loan_t`)).toMatch(/^unhex\('7d2768de…ddc7a9'\) is not Aave's Pool on this chain/);
    expect(refused(`WITH ${px} SELECT count() AS n FROM raw_logs WHERE ${week} AND address IN (SELECT market FROM lending_markets WHERE chain_id = 43114) AND topic0 = ${stray}`)).toMatch(/^unhex\('0bcc1e4a…bbda7a'\) is no event of /);
    expect(refused(`SELECT count() AS n FROM raw_logs WHERE ${week} AND address = ${lb} AND topic0 = qi_borrow_t UNION ALL SELECT count() AS n FROM raw_logs WHERE ${week} AND address = aave_pool AND topic0 = borrow_t`)).toMatch(/^unhex\('d446eb16…26f7d1'\) is no Benqi market on this chain/);
  });
});

describe('a lending answer', () => {
  it("names each protocol's slug as the dApp pages name it", async () => {
    vi.stubGlobal('fetch', vi.fn(async () => Response.json({ tokens: {} })));
    const names = await enrichNames(43114, [{ name: 'protocol', type: 'String' }], [{ protocol: AAVE_SLUG }, { protocol: BENQI }], 'http://localhost:3000');
    expect(names.protocol).toEqual({ [AAVE_SLUG]: LENDING_PROTOCOLS[AAVE_SLUG], [BENQI]: LENDING_PROTOCOLS[BENQI] });
  });
});

describe('an earlier turn shown to the writer', () => {
  it('has its shorthand back in place of the WITH it wrote, and any other query as it came', () => {
    const calls = [
      `$DEX(${today}) SELECT protocol, round(sum(usd), 2) AS volume_usd FROM legs GROUP BY protocol`,
      `$DEX(toDateTime('2026-09-26 00:00:00'), toDateTime('2026-09-27 00:00:00'), 'uniswap') SELECT version, round(sum(usd), 2) AS volume_usd FROM legs GROUP BY version`,
      "$POOLS('pharaoh'), p AS (SELECT pool FROM pools) SELECT count() AS n FROM p",
      `$LEND(now() - INTERVAL 24 HOUR, '${AAVE_SLUG}') SELECT toStartOfHour(t) AS hour, count() AS deposits FROM actions WHERE action = 'supply' GROUP BY hour ORDER BY hour`,
      `$LEND(${today} - INTERVAL 7 DAY, ${today}) SELECT protocol, round(sum(usd)) AS usd FROM actions GROUP BY protocol`,
      `$LIQUIDATIONS(toMonday(now()), '${BENQI}') SELECT count() AS n FROM liquidations`,
      `$DEBTS('${BENQI}') SELECT round(sum(usd)) AS debt_usd FROM debts`,
      `$MARKETS('${AAVE_SLUG}') SELECT protocol, supplied_usd FROM markets`,
      `$PRICES(toMonday(now())) SELECT d, px['avax'] AS avax FROM lpx`,
    ];
    for (const call of calls) {
      const g = guardSql(call, 43114);
      expect(g.ok, call).toBe(true);
      if (!g.ok) continue;
      // the guard adds the row cap unless the WITH has a LIMIT of its own
      expect(collapseMacros(g.sql, 43114), call).toBe(g.sql.endsWith('\nLIMIT 2000') ? `${call}\nLIMIT 2000` : call);
    }
    const plain = "SELECT count() AS n FROM raw_logs WHERE chain_id = 43114 AND block_time >= now() - INTERVAL 1 HOUR\nLIMIT 2000";
    expect(collapseMacros(plain, 43114)).toBe(plain);
    const g = guardSql(calls[0], 43114);
    if (g.ok) expect(collapseMacros(g.sql, 43113)).toBe(g.sql);
  });
});

describe('a question that names a protocol', () => {
  const MASTERCHEF = "SELECT toStartOfHour(block_time) AS hour, count() AS deposits FROM raw_txs WHERE chain_id = 43114 AND block_time >= now() - INTERVAL 24 HOUR AND substring(input, 1, 4) = unhex('e2bbb158') GROUP BY hour";
  const scope = (sql: string, ...questions: string[]) => protocolScope(sql, questions, 43114);

  it('is sent back once when the query reads none of its contracts, naming the shorthand and the addresses to use', () => {
    const why = scope(MASTERCHEF, 'aave deposits last 24 hrs');
    expect(why).toMatch(/^the question names Aave, and the query reads none of Aave's contracts, so its rows are not Aave's\. Open it with \$LEND\(start, 'aave-v3'\)/);
    expect(why).toContain('0x794a61358d6845594f94dc1db02a252b5b4814ad');
    expect(why).toMatch(/Then call render_chart again\.$/);
    // the refine of an earlier turn keeps that turn's protocol
    expect(scope(MASTERCHEF, 'refine this: dollar value of deposits', 'aave deposits last 24 hrs')).toMatch(/^the question names Aave,/);
    expect(scope(`$LEND(now() - INTERVAL 24 HOUR) SELECT count() AS n FROM actions WHERE action = 'supply'`, 'aave deposits last 24 hrs')).toMatch(/^the question names Aave,/);
    expect(scope(`$DEX(${today}) SELECT version, round(sum(usd), 2) AS volume_usd FROM legs GROUP BY version`, 'Uniswap volume by version today')).toMatch(/^the question names Uniswap, .* Open it with \$DEX\(start, 'uniswap'\)/);
    expect(scope("SELECT count() AS n FROM raw_logs WHERE chain_id = 43114 AND block_time >= now() - INTERVAL 1 DAY AND topic0 = unhex('2b627736bca15cd5381dcf80b0bf11fd197d01a037c52b927a881a10fb73ba61')", 'Benqi deposits today')).toMatch(/^the question names Benqi,/);
  });

  it("passes a query that reads the protocol by address, slug, server name or table, or a DEX's pool", () => {
    expect(scope(`$LEND(now() - INTERVAL 24 HOUR, '${AAVE_SLUG}') SELECT count() AS n FROM actions`, 'aave deposits last 24 hrs')).toBeNull();
    expect(scope(`$LEND(${today}) SELECT count() AS n FROM actions WHERE protocol = '${AAVE_SLUG}'`, 'aave deposits today')).toBeNull();
    expect(scope("SELECT count() AS n FROM raw_logs WHERE chain_id = 43114 AND block_time >= now() - INTERVAL 1 DAY AND address = aave_pool", 'Aave events today')).toBeNull();
    expect(scope("SELECT count() AS n FROM raw_logs WHERE chain_id = 43114 AND block_time >= now() - INTERVAL 1 DAY AND address = unhex('794A61358D6845594F94DC1DB02A252B5B4814AD')", 'Aave events today')).toBeNull();
    expect(scope("SELECT count() AS n FROM raw_logs AS l WHERE l.chain_id = 43114 AND l.block_time >= now() - INTERVAL 1 DAY AND l.address IN (SELECT market FROM lending_markets WHERE chain_id = 43114)", 'Benqi events today')).toBeNull();
    expect(scope(`$DEX(${today}, 'uniswap') SELECT version, round(sum(usd), 2) AS volume_usd FROM legs GROUP BY version`, 'Uniswap volume by version today')).toBeNull();
    expect(scope("SELECT count() AS swaps FROM raw_logs WHERE chain_id = 43114 AND block_time >= toMonday(now()) AND address = unhex('fae3f424a0a47706811521e3ee268f00cfb5c45e')", 'LP fees in the Uniswap v3 WAVAX/USDC 0.05% pool this week')).toBeNull();
    expect(scope(`$DEX(${today}, 'trader-joe') SELECT count() AS n FROM legs`, 'LFJ swaps today')).toBeNull();
    // a shorthand with no slug reads both protocols a question compares, and not one it names alone
    expect(scope(`$LEND(${today}) SELECT protocol, t, usd FROM actions WHERE action = 'supply' ORDER BY usd DESC LIMIT 20`, 'What were the largest deposits into Aave and Benqi today?')).toBeNull();
    expect(scope(`$DEX(${today}) SELECT protocol, round(sum(usd)) AS v FROM legs GROUP BY protocol`, 'Uniswap or Pharaoh: which had more volume today?')).toBeNull();
    expect(scope(`$MARKETS('${AAVE_SLUG}') SELECT protocol, asset, utilization_pct FROM markets`, 'What is the utilization of each lending market on Aave and Benqi?')).toBeNull();
    expect(scope(`$LEND(${today}, '${BENQI}') SELECT t, usd FROM actions WHERE action = 'supply' ORDER BY usd DESC LIMIT 20`, 'What were the largest deposits into Aave and Benqi today?')).toMatch(
      /^the question names Aave, .* The question names Aave and Benqi: open the query with \$LEND\(start\) and no slug, which reads all of them/,
    );
  });

  it('reads the longest name, a common word only as a name, and nothing on other chains or in a question with no protocol', () => {
    expect(namedIn(['aave v2 deposits'])).toEqual([['Aave V2']]);
    expect(namedIn(['aave deposits'])).toEqual([['Aave', 'Aave V2']]);
    expect(namedIn(['Blackhole swaps today'])[0]).toEqual(expect.arrayContaining(['Blackhole', 'Blackhole DEX']));
    expect(namedIn(['show the curve of gas prices'])).toEqual([]);
    expect(namedIn(['Curve pools by volume'])).toEqual([['Curve']]);
    expect(namedIn(['LFJ volume'])[0]).toContain('Trader Joe');
    expect(namedIn(['Transactions per hour on Avalanche today', 'What is the volume per DEX today?'])).toEqual([]);
    expect(scope(MASTERCHEF, 'deposits per hour')).toBeNull();
    expect(protocolScope(MASTERCHEF, ['aave deposits last 24 hrs'], 43113)).toBeNull();
    expect(protocolScope(MASTERCHEF, ['aave deposits last 24 hrs'], 432204)).toBeNull();
  });
});

describe('an answer for one of two protocols', () => {
  const q = ['What is the utilization of each lending market on Aave and Benqi?'];
  const sql = `$MARKETS('${AAVE_SLUG}') SELECT protocol, asset, utilization_pct FROM markets`;

  it('says in its note which protocol it covers, and offers the other next', () => {
    expect(oneProtocol(sql, 'Utilization of each market on Aave and Benqi.', q, 43114)).toBe(
      `the question names Aave and Benqi, and $MARKETS covers one protocol per query, so this answer covers Aave only. Add both of these sentences to the note, as they are: "This answer covers Aave only." and "Ask for Benqi's markets next." Then call render_chart again with the same SQL.`,
    );
    expect(oneProtocol(sql, "Aave's markets only; ask for Benqi's markets next.", q, 43114)).toBeNull();
    for (const note of ["This answer covers Aave only. Ask for Benqi's markets next.", "Only the Aave reserves are shown; ask for Benqi's markets next.", 'Aave v3 only. Benqi is next.'])
      expect(oneProtocol(sql, note, q, 43114), note).toBeNull();
    // a replay of L07 answered the send-back with the offer alone, and an only of another sense says nothing of the protocol
    for (const note of [
      "Aave v3 has 18 reserves. Supplied and borrowed are in USD at current prices. TVL (total value locked) is supplied less borrowed. Tokens with no price show no values. Ask for Benqi's markets next.",
      "Only priced tokens show values. Ask for Benqi's markets next.",
      "Aave's 18 reserves, with only priced tokens valued. Ask for Benqi's markets next.",
    ])
      expect(oneProtocol(sql, note, q, 43114), note).toMatch(/^the question names Aave and Benqi, and \$MARKETS covers one protocol per query/);
    expect(oneProtocol(sql, 'Utilization of each Aave market.', ['What is the utilization of each Aave market?'], 43114)).toBeNull();
    expect(oneProtocol(`$LEND(${today}) SELECT count() AS n FROM actions`, 'x', q, 43114)).toBeNull();
    expect(oneProtocol(sql, 'x', q, 43113)).toBeNull();
  });
});

describe('one shorthand typed for two protocols', () => {
  const refused = (sql: string) => {
    const g = guardSql(sql, 43114);
    return g.ok ? '' : g.error;
  };
  const q = ['How much is supplied and borrowed on Aave and Benqi, and what is their TVL?'];

  it('is told to answer one protocol and name the other next, with the two sentences to copy', () => {
    // a replay of L07 spent 4 of its 8 steps on one query for both: WITH aave AS ($MARKETS(…) …), a second $MARKETS in a
    // WITH of its own, and then figures typed in by hand
    const say = `$MARKETS covers one protocol per query, and a query takes one shorthand, so $MARKETS('${AAVE_SLUG}') and $MARKETS('${BENQI}') cannot share one: both at once are too long to send. Answer Aave alone, with $MARKETS('${AAVE_SLUG}') at the query's start and no other shorthand, and add both of these sentences to the note, as they are: "This answer covers Aave only." and "Ask for Benqi's markets next."`;
    for (const sql of [
      `WITH aave AS ($MARKETS('${AAVE_SLUG}') SELECT sum(supplied_usd) AS supplied_usd FROM markets), benqi AS ($MARKETS('${BENQI}') SELECT sum(supplied_usd) AS supplied_usd FROM markets) SELECT * FROM aave UNION ALL SELECT * FROM benqi`,
      `$MARKETS('${AAVE_SLUG}'), b AS ($MARKETS('${BENQI}') SELECT sum(supplied_usd) AS supplied_usd FROM markets) SELECT sum(supplied_usd) AS supplied_usd FROM markets UNION ALL SELECT supplied_usd FROM b`,
    ])
      expect(refused(sql)).toBe(say);
    expect(refused(`$DEBTS('${BENQI}'), a AS ($DEBTS('${AAVE_SLUG}') SELECT count() AS n FROM debts) SELECT count() AS n FROM debts`)).toMatch(/^\$DEBTS covers one protocol per query, .* "This answer covers Benqi only\." and "Ask for Aave's debts next\."$/);
    // the note it asks for is the one the note check passes
    expect(oneProtocol(`$MARKETS('${AAVE_SLUG}') SELECT sum(supplied_usd) AS supplied_usd FROM markets`, "Aave's supply now. This answer covers Aave only. Ask for Benqi's markets next.", q, 43114)).toBeNull();
    // a shorthand that takes no slug reads both, and any other second shorthand is refused as before
    expect(refused(`$LEND(${today}, '${AAVE_SLUG}'), b AS ($LEND(${today}, '${BENQI}') SELECT count() AS n FROM actions) SELECT count() AS n FROM actions`)).toBe(
      `a query takes one shorthand, once, at its start, and $LEND with no slug reads every protocol: open the query once with $LEND(start) and keep protocol as a column, or filter protocol IN ('${AAVE_SLUG}', '${BENQI}')`,
    );
    expect(refused(`$MARKETS('${AAVE_SLUG}'), d AS ($DEBTS('${BENQI}') SELECT count() AS n FROM debts) SELECT count() AS n FROM markets`)).toMatch(/^the shorthand stands for the query's WITH, once, at its start: /);
    expect(refused(`WITH m AS ($MARKETS('${AAVE_SLUG}') SELECT count() AS n FROM markets) SELECT n FROM m`)).toMatch(/^the shorthand stands for the query's WITH, once, at its start: /);
  });

  it('typed in by hand from the tests is sent back the same way the first time', () => {
    // replays of L07 summed each market's figures by hand into a query that reads no table
    const typed = "the query reads no table, so its figures are typed in, and a figure copied from a test's rows is stale on every later run";
    expect(refused("SELECT 'Aave' AS protocol, 186289990.94 + 99968525.73 AS supplied_usd, 1200.5 AS tvl_usd UNION ALL SELECT 'Benqi' AS protocol, 101.5 + 2.25 AS supplied_usd, 3.5 AS tvl_usd")).toBe(
      `${typed}. $MARKETS covers one protocol per query, so answer Aave alone, with $MARKETS('${AAVE_SLUG}') at the query's start, and add both of these sentences to the note, as they are: "This answer covers Aave only." and "Ask for Benqi's markets next."`,
    );
    expect(refused(`SELECT '${BENQI}' AS protocol, 12.5 AS debt_usd UNION ALL SELECT '${AAVE_SLUG}', 30.25`)).toMatch(/\$DEBTS covers one protocol per query, so answer Benqi alone, .* "This answer covers Benqi only\." and "Ask for Aave's debts next\."$/);
    expect(refused("SELECT 'Aave v3' AS protocol, 1200.5 AS deposits_usd UNION ALL SELECT 'Benqi', 300.25")).toBe(`${typed}. $LEND and $LIQUIDATIONS with no slug read both protocols: open the query with one of them and keep protocol as a column`);
    // one protocol or none, and any chain but the mainnet C-Chain, keep the plain refusal
    for (const [sql, chainId] of [["SELECT 'Aave' AS protocol, 1200.5 AS supplied_usd", 43114], ['SELECT 1 AS n', 43114], ["SELECT 'Aave' AS a, 'Benqi' AS b, 1.5 AS supplied_usd", 43113]] as const) {
      const g = guardSql(sql, chainId);
      expect(g.ok ? '' : g.error, sql).toMatch(/^the query reads no table; use /);
    }
  });
});

describe('a value column', () => {
  it('is named by the unit it holds', () => {
    const d16 = "WITH s AS (SELECT toStartOfHour(block_time) AS hour, 1. AS amount0 FROM raw_logs WHERE chain_id = 43114 AND block_time >= toMonday(now())), px AS (SELECT toStartOfHour(block_time) AS hour, 1. AS price FROM raw_logs WHERE chain_id = 43114 AND block_time >= toMonday(now()) GROUP BY hour) SELECT round(sum((amount0 / 1e18) * px.price * 500 / 1e6), 2) AS fees_avax FROM s LEFT JOIN px ON s.hour = px.hour";
    expect(unitName(d16, 43114)).toBe('fees_avax is named for AVAX, and it is made from a value in dollars (usd or a price). Name a value by its unit, _usd for dollars and _avax for AVAX, and make it hold that unit: fees_usd for this one. Then call render_chart again.');
    expect(unitName(d16.replace('AS fees_avax', 'AS fees_usd'), 43114)).toBeNull();
    expect(unitName(`$DEX(${today}) SELECT round(sum(usd * k / 1e6), 2) AS fees_usd, round(sum(usd / nullIf(x.price, 0)), 2) AS volume_in_avax_units FROM legs`, 43114)).toBeNull();
    expect(unitName("SELECT sum(gas_used * gas_price) / 1e18 AS fees_avax FROM raw_txs WHERE chain_id = 43114 AND block_time >= now() - INTERVAL 1 DAY", 43114)).toBeNull();
    expect(unitName("SELECT 'price' AS label, count() AS n_avax FROM raw_txs WHERE chain_id = 43114 AND block_time >= now() - INTERVAL 1 DAY", 43114)).toBeNull();
    expect(unitName(d16, 43113)).toBeNull();
  });

  it('keeps the digits of a token amount, and only dollars round', () => {
    // L05n: whole units showed Aave's net borrow of -0.13 BTC.b as 0
    const net = (col: string) => `$LEND(toMonday(now())) SELECT lower(concat('0x', hex(asset))) AS token, protocol, ${col}, count() AS actions FROM actions GROUP BY token, protocol`;
    const l05n = net("round(sum(if(action = 'supply', amount, 0)) - sum(if(action = 'withdraw', amount, 0))) AS net_supply, round(sum(if(action = 'borrow', amount, 0)) - sum(if(action = 'repay', amount, 0))) AS net_borrow");
    expect(unitName(l05n, 43114)).toBe('net_supply rounds a token amount to whole units, so a small one reads 0 (-0.13 BTC.b showed as 0). Leave a token amount unrounded, since the page shows its significant digits; only a value in dollars rounds, to cents: round(x, 2). Then call render_chart again.');
    expect(unitName(net('round(sum(amount), 0) AS supplied_units'), 43114)).toMatch(/^supplied_units rounds a token amount to whole units/);
    expect(unitName(`$DEX(${today}) SELECT pool, round(sum(r0 / pow(10, 6))) AS usdc_moved FROM legs GROUP BY pool`, 43114)).toMatch(/^usdc_moved rounds /);
    // an amount with its digits, a rounded dollar value, a percent and a count pass, and so does every other chain
    expect(unitName(net("sumIf(if(action = 'borrow', amount, -amount), action IN ('borrow', 'repay')) AS net_borrow, round(sumIf(if(action = 'borrow', usd, -usd), action IN ('borrow', 'repay')), 2) AS net_borrow_usd"), 43114)).toBeNull();
    expect(unitName(net('round(sum(usd)) AS value_usd, round(sum(amount), 6) AS amount_units'), 43114)).toBeNull();
    expect(unitName(`$MARKETS('${AAVE_SLUG}') SELECT asset, round(100 * borrowed / nullIf(supplied, 0)) AS utilization_pct FROM markets`, 43114)).toBeNull();
    for (const chainId of [43113, 432204, 1]) expect(unitName(l05n, chainId)).toBeNull();
  });

  it('is never a net of two sums of USD that is NULL when one side has no rows', () => {
    // a replay of L05n showed a net borrow of 3,000 USDt with no USD: the USDt repayments were none, and their sumIf NULL
    const net = (col: string) => `$LEND(toMonday(now())) SELECT protocol, asset, ${col} FROM actions GROUP BY protocol, asset`;
    expect(unitName(net("round(sumIf(usd, action = 'borrow') - sumIf(usd, action = 'repay'), 2) AS net_borrow_usd"), 43114)).toBe(
      "net_borrow_usd is one sumIf of usd less another, and a sumIf over no rows is NULL, so it is NULL for an asset with only one of the two actions. Write it as one sum with a sign that is 0 where neither action happened: if(countIf(action IN ('borrow', 'repay')) = 0, 0, sumIf(if(action = 'borrow', usd, -usd), action IN ('borrow', 'repay'))). Then call render_chart again.",
    );
    expect(unitName(net("round(sumIf(if(action = 'borrow', usd, -usd), action IN ('borrow', 'repay')), 2) AS net_borrow_usd"), 43114)).toBeNull();
    expect(unitName(net("round(ifNull(sumIf(usd, action = 'borrow'), 0) - ifNull(sumIf(usd, action = 'repay'), 0), 2) AS net_borrow_usd"), 43114)).toBeNull();
    expect(unitName(net("round(100 * sumIf(usd, action = 'borrow') / nullIf(sum(usd), 0), 2) AS borrow_share_pct"), 43114)).toBeNull();
  });

  it('holds a USD figure NULL where its amount is 0, and a note that says an asset has no price, against the rows', () => {
    // a replay of L05n: net_borrow_usd NULL where net_borrow was 0, and a note that read it as a missing price
    const sql = "$LEND(toMonday(now())) SELECT protocol, lower(concat('0x', hex(asset))) AS token, net_supply, net_supply_usd, net_borrow, net_borrow_usd FROM actions";
    const columns = ['protocol', 'token', 'net_supply', 'net_supply_usd', 'net_borrow', 'net_borrow_usd'].map((name) => ({ name }));
    const WETH = '0x49d5c2bdffac6ce2bfdb6640f4f80f226bc10bab';
    const row = (token: string, borrow: number, borrowUsd: number | null) => ({ protocol: 'aave', token, net_supply: 1.2, net_supply_usd: 2349.79, net_borrow: borrow, net_borrow_usd: borrowUsd });
    const L05N = { columns, rows: [row(WETH, 0, null), row('0xb97ef9ef8734c71904d8002f8b6bc66dd9c48a6e', -40, -40)] };
    const form = "if(countIf(action IN ('borrow', 'repay')) = 0, 0, sumIf(if(action = 'borrow', usd, -usd), action IN ('borrow', 'repay')))";
    expect(zeroUsd(sql, 'Net supply and borrow per asset since Monday. Some assets lack USD prices.', L05N, 43114)).toBe(
      `net_borrow_usd is NULL in 1 row where net_borrow is 0, such as WETH.e: a sum of usd over no rows, not a missing price. Write it so it is 0 where no event counts, as in ${form}. The note says an asset has no USD price, but WETH.e is priced: say it only of an asset whose usd is NULL where its amount is not 0. Then call render_chart again.`,
    );
    expect(zeroUsd(sql, 'Net supply and borrow per asset since Monday.', L05N, 43114)).toMatch(/^net_borrow_usd is NULL in 1 row where net_borrow is 0, such as WETH\.e: .* as in .*\)\)\)\. Then call render_chart again\.$/);
    // an amount with no USD is an asset with no price, as the note may say
    const AAVE_E = '0x63a72806098bd3d9520cc43356dd78afe5d386d9';
    expect(zeroUsd(sql, 'AAVE.e lacks a USD price.', { columns, rows: [row(AAVE_E, 5, null)] }, 43114)).toBeNull();
    expect(zeroUsd(sql, 'AAVE.e lacks a USD price.', { columns, rows: [row(AAVE_E, 0, null)] }, 43114)).toBeNull();
    // a note that says none is priced over rows that all are is pricedNote's to mend, with no send-back
    expect(zeroUsd(sql, 'Some assets lack USD prices.', { columns, rows: [row(WETH, 2, 5000)] }, 43114)).toBeNull();
    expect(zeroUsd(sql, 'Some events lack USD prices.', { columns: [...columns, { name: 'unpriced' }], rows: [{ ...row(WETH, 2, 5000), unpriced: 3 }] }, 43114)).toBeNull();
    // the right form reads 0, and every other chain, and a query that reads no lending contract, is left alone
    expect(zeroUsd(sql, 'Some assets lack USD prices.', { columns, rows: [row(WETH, 0, 0)] }, 43114)).toBeNull();
    expect(zeroUsd(sql, '', { columns, rows: [row(WETH, 0, 0)] }, 43114)).toBeNull();
    for (const chainId of [43113, 432204]) expect(zeroUsd(sql, 'Some assets lack USD prices.', L05N, chainId)).toBeNull();
    expect(zeroUsd("$DEX(toMonday(now())) SELECT pool, sum(r0) AS volume, sum(usd) AS volume_usd FROM legs GROUP BY pool", '', { columns: [{ name: 'volume' }, { name: 'volume_usd' }], rows: [{ volume: 0, volume_usd: null }] }, 43114)).toBeNull();
  });

  it('leaves out a note sentence that says an asset has no USD price when every row has its USD figures', () => {
    // the send-back L05y, L05nx, L12z, L12ny and L14y paid 2 to 4 s for: each second call only left the sentence out
    const sql = "$LEND(toMonday(now())) SELECT protocol, lower(concat('0x', hex(asset))) AS token, net_supply, net_supply_usd FROM actions";
    const columns = ['protocol', 'token', 'net_supply', 'net_supply_usd'].map((name) => ({ name }));
    const WETH = '0x49d5c2bdffac6ce2bfdb6640f4f80f226bc10bab';
    const AAVE_E = '0x63a72806098bd3d9520cc43356dd78afe5d386d9';
    const row = (token: string, usd: number | null) => ({ protocol: 'aave', token, net_supply: 1.2, net_supply_usd: usd });
    const priced = { columns, rows: [row(WETH, 2349.79), row('0xb97ef9ef8734c71904d8002f8b6bc66dd9c48a6e', -40)] };
    expect(pricedNote(sql, 'Net supply per asset since Monday. Assets without a USD price are counted as unpriced. The current day is not over.', priced, 43114)).toBe(
      'Net supply per asset since Monday. The current day is not over.',
    );
    expect(pricedNote(sql, 'Some assets lack USD prices.', priced, 43114)).toBe('');
    // a note with no price words, an unpriced event, a NULL figure or an asset with no price kind keep the note
    expect(pricedNote(sql, 'Net supply per asset since Monday.', priced, 43114)).toBeNull();
    expect(pricedNote(sql, 'Some events lack USD prices.', { columns: [...columns, { name: 'unpriced' }], rows: [{ ...row(WETH, 5000), unpriced: 3 }] }, 43114)).toBeNull();
    expect(pricedNote(sql, 'Some assets lack USD prices.', { columns, rows: [row(WETH, null)] }, 43114)).toBeNull();
    expect(pricedNote(sql, 'AAVE.e lacks a USD price.', { columns, rows: [row(WETH, 5000), row(AAVE_E, 0)] }, 43114)).toBeNull();
    // other chains, and a query that reads no lending contract, are left alone
    for (const chainId of [43113, 432204]) expect(pricedNote(sql, 'Some assets lack USD prices.', priced, chainId)).toBeNull();
    expect(pricedNote("$DEX(toMonday(now())) SELECT pool, sum(usd) AS volume_usd FROM legs GROUP BY pool", 'Some pools lack USD prices.', { columns: [{ name: 'volume_usd' }], rows: [{ volume_usd: 5 }] }, 43114)).toBeNull();
  });
});
