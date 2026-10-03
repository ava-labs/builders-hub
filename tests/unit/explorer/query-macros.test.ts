import { describe, expect, it } from 'vitest';

import { guardSql, HASH_RANGE, literalWindow, negativeFigure, QUERY_CHARS } from '@/lib/explorer-query/guard';
import { collapseMacros, DEX_WITH, expandMacros } from '@/lib/explorer-query/macros';
import { pchainPrompt, systemPrompt, userTurn } from '@/lib/explorer-query/prompt';
import { DEX_FACTORIES, DEX_PROTOCOLS, DEX_TOPICS, V2_FEE_PROTOCOLS } from '@/lib/explorer-query/protocols';
import { SQL_BUDGET, withSources } from '@/lib/explorer-query/sources';

const today = 'toStartOfDay(now())';
const OWN = ' SELECT protocol, round(sum(usd), 2) AS volume_usd FROM legs GROUP BY protocol';
const expanded = (sql: string) => {
  const x = expandMacros(sql, 43114);
  return x.ok ? x.sql : `refused: ${x.error}`;
};
const refused = (sql: string) => {
  const x = expandMacros(sql, 43114);
  return x.ok ? '' : x.error;
};
const slug = Object.keys(DEX_PROTOCOLS)[0];
const OLD = 'write the DEX WITH out in full: $DEX, $POOLS, $START and $PROTOCOL stand for its text';

describe('the DEX shorthand', () => {
  it('writes the DEX WITH out with the start in both of its places, and a protocol filter for a slug', () => {
    const all = expanded(`$DEX(${today})${OWN}`);
    expect(all).toBe(DEX_WITH.replaceAll('$START', today).replace('$END', '').replaceAll('$PROTOCOL', '') + OWN);
    expect(all.split(`block_time >= ${today}`).length - 1).toBe(2);
    const one = expanded(`$DEX(now() - INTERVAL 7 DAY, '${slug}')${OWN}`);
    expect(one).toContain(`WHERE chain_id = 43114 AND protocol = '${slug}')`);
    expect(one).toContain('block_time >= now() - INTERVAL 7 DAY - INTERVAL 1 HOUR');
    expect(one).not.toMatch(/\$(START|END|PROTOCOL)/);
  });

  it("stops the window's Swap logs at an end, before the slug, and reads quoted dates as DateTimes", () => {
    const day = expanded(`$DEX(toDateTime('2026-09-26 00:00:00'), toDateTime('2026-09-27 00:00:00'), '${slug}')${OWN}`);
    expect(day).toContain("WHERE chain_id = 43114 AND block_time >= toDateTime('2026-09-26 00:00:00') AND block_time < toDateTime('2026-09-27 00:00:00') AND topic0 IN (v2_swap, v3_swap, lb_swap, v4_swap, woo_swap))");
    expect(day).toContain(`WHERE chain_id = 43114 AND protocol = '${slug}')`);
    expect(day.split('block_time < ').length - 1).toBe(1);
    expect(expanded(`$DEX('2026-09-21', '2026-09-28')${OWN}`)).toContain("block_time >= toDateTime('2026-09-21') AND block_time < toDateTime('2026-09-28') AND topic0");
    expect(expanded(`$DEX(${today}, now())${OWN}`)).toContain(`block_time >= ${today} AND block_time < now() AND topic0`);
    expect(expanded(`$DEX(${today}, '${slug}')${OWN}`)).not.toContain('block_time < ');
  });

  it("reads WOOFi's WooSwap in legs: each WooPP contract a pool, each swap its own tokens, no fee where it logs 0", () => {
    const all = expanded(`$DEX(${today}) SELECT protocol, count() AS swaps FROM legs GROUP BY protocol`);
    expect(all).toContain(`unhex('${DEX_TOPICS.wooSwap}') AS woo_swap`);
    expect(all).toContain('AND topic0 IN (v2_swap, v3_swap, lb_swap, v4_swap, woo_swap))');
    expect(all).toContain("UNION ALL SELECT protocol, version, factory AS pool, '' AS t0, '' AS t1, 0 AS k FROM dex_factories WHERE chain_id = 43114 AND family = 'woofi' )");
    expect(all).toContain('ifNull(s.wt0, p.pt0) AS t0, ifNull(s.wt1, p.pt1) AS t1');
    // a slug keeps one protocol's pools in both parts of pools
    expect(expanded(`$DEX(${today}, '${slug}') SELECT count() AS swaps FROM legs`).match(new RegExp(`AND protocol = '${slug}'`, 'g'))).toHaveLength(2);
    const fees = expanded(`$DEX(${today}) SELECT round(sum(fee_usd), 2) AS fees_usd FROM legs`);
    expect(fees).toContain('topic0 = woo_swap, nullIf(toFloat64(reinterpretAsUInt256(reverse(substring(data, 161, 32)))), 0) / nullIf(toFloat64(reinterpretAsUInt256(reverse(substring(data, 129, 32)))), 0)');
  });

  it('writes $POOLS as the Swap topic names and the pools alone', () => {
    const pools = expanded('$POOLS() SELECT count() AS pools FROM pools');
    expect(pools).toMatch(/^WITH unhex\('[0-9a-f]{64}'\) AS v2_swap, .* AS woo_swap, pools AS \(SELECT /);
    expect(pools).not.toContain('swap_logs');
    expect(pools).not.toContain('AND protocol =');
    expect(expanded(`$POOLS('${slug}') SELECT count() AS pools FROM pools`)).toContain(`AND protocol = '${slug}')`);
  });

  it("reads a quoted date as a DateTime, and joins the query's own WITH to the shorthand's", () => {
    expect(expanded(`$DEX('2026-09-26')${OWN}`)).toContain("block_time >= toDateTime('2026-09-26') - INTERVAL 1 HOUR");
    expect(expanded(`WITH $DEX(${today})${OWN}`)).toBe(expanded(`$DEX(${today})${OWN}`));
    const own = expanded(`$DEX(${today}) WITH d AS (SELECT pool, usd FROM legs) SELECT count() AS n FROM d`);
    expect(own).toContain('LEFT JOIN px AS x ON toStartOfHour(s.block_time) = x.hour), d AS (SELECT pool, usd FROM legs) SELECT count()');
    expect(expanded(`$DEX(${today}), d AS (SELECT pool FROM legs) SELECT count() AS n FROM d`)).toContain('x.hour), d AS (SELECT pool FROM legs)');
  });

  it("names its quotes dex_quotes, so a query's own WITH may call a part q", () => {
    // the latency audit's D20: a writer's own CTE named q met the shorthand's and failed its test
    const own = expanded(`$DEX(${today}), q AS (SELECT pool, usd FROM legs) SELECT count() AS n FROM q`);
    expect(own).toContain('dex_quotes AS (SELECT groupArrayIf(token, quote = \'usd\') AS S');
    expect(own).toContain('CROSS JOIN dex_quotes LEFT JOIN px AS x');
    expect(own.match(/\bq AS \(/g)).toHaveLength(1);
    expect(guardSql(`$DEX(${today}), q AS (SELECT pool, usd FROM legs) SELECT count() AS n FROM q`, 43114).ok).toBe(true);
  });

  it('refuses any other name, a second shorthand, one after the start, a slug no protocol has, and a WITH with nothing after it', () => {
    expect(refused(`$SWAPS(${today})${OWN}`)).toMatch(/^\$SWAPS is no shorthand here: open the query with one shorthand: \$DEX, \$LEND or \$LIQUIDATIONS with the window's start/);
    expect(refused(`$DEX($START)${OWN}`)).toMatch(/^\$START is no shorthand here/);
    expect(refused(`$DEX(${today}), p AS ($POOLS()) SELECT 1`)).toMatch(/^the shorthand stands for the query's WITH, once, at its start/);
    expect(refused(`SELECT * FROM ($DEX(${today})${OWN})`)).toMatch(/^the shorthand stands for the query's WITH, once, at its start/);
    expect(refused(`$DEX(${today}, 'no-such-dex')${OWN}`)).toBe(`'no-such-dex' is not a protocol's slug; the slugs are ${Object.keys(DEX_PROTOCOLS).map((s) => `'${s}'`).join(', ')}`);
    expect(refused(`$DEX('${slug}')${OWN}`)).toBe("$DEX takes the window's start first, then the slug: $DEX(toStartOfDay(now()), 'pharaoh')");
    expect(refused(`$DEX(${today}, now(), '${slug}', 'x')${OWN}`)).toMatch(/^\$DEX takes at most the window's start, its end and a slug: /);
    expect(refused(`$DEX(${today}, '${slug}', 'x')${OWN}`)).toBe("$DEX takes one slug, last: $DEX(toStartOfDay(now()) - INTERVAL 1 DAY, toStartOfDay(now()), 'pharaoh')");
    expect(refused(`$POOLS(${today})${OWN}`)).toMatch(/^\$POOLS takes at most a slug: /);
    expect(refused(`$DEX(${today})`)).toMatch(/^\$DEX\(…\) is only the WITH/);
    expect(refused(`$DEX(${today}${OWN}`)).toMatch(/^\$DEX\( is not closed/);
  });

  it('leaves a $ inside a string as text, and every chain but the mainnet C-Chain as it was', () => {
    const text = "SELECT '$DEX(now())' AS s, count() AS n FROM raw_logs WHERE chain_id = 43114 AND block_time >= now() - INTERVAL 1 HOUR";
    expect(expanded(text)).toBe(text);
    for (const chainId of [43113, 432204, 1, 5]) {
      const sql = `$DEX(${today})${OWN}`;
      expect(expandMacros(sql, chainId)).toEqual({ ok: true, sql });
      const g = guardSql(sql, chainId);
      expect(g.ok ? '' : g.error).toBe(OLD);
    }
  });

  it("keeps a factory that ends in a zero byte, and the registry has no factory or positions contract a query's own join would miss", () => {
    // a String joined to raw_logs.address (a FixedString) loses its trailing zero bytes: aAvaUSDe (…fb00) matched no log
    for (const call of [`$DEX(${today})`, '$POOLS()']) {
      const sql = expanded(`${call} SELECT count() AS n FROM pools`);
      expect(sql, call).toContain('INNER JOIN dex_factories AS f ON l.address = toFixedString(f.factory, 20)');
      expect(sql, call).toContain('l.address IN (SELECT toFixedString(factory, 20) FROM dex_factories WHERE chain_id = 43114');
    }
    // a query of its own reads dex_factories as the table sends it, a String: no listed address may end in 00
    expect(DEX_FACTORIES.filter((f) => f.factory.endsWith('00')).map((f) => f.factory)).toEqual([]);
    expect(DEX_FACTORIES.flatMap((f) => f.positions).filter((a) => a.endsWith('00'))).toEqual([]);
  });

  it('runs through the guard as the whole WITH, and a query too long says what its own part may take', () => {
    const g = guardSql(`$DEX(${today})${OWN}`, 43114);
    expect(g.ok && g.sql.startsWith(DEX_WITH.slice(0, 40)) && g.tables.includes('raw_logs')).toBe(true);
    const long = guardSql(`$DEX(${today})${OWN} HAVING volume_usd > ${'1 + '.repeat(2200)}1`, 43114);
    const size = DEX_WITH.replaceAll('$START', today).replace('$END', '').replaceAll('$PROTOCOL', '').length;
    expect(long.ok ? '' : long.error).toMatch(new RegExp(`^query too long: \\d+ characters with \\$DEX written out, ${QUERY_CHARS} at most\\. Its WITH takes ${size}, so what follows it may take ${QUERY_CHARS - size}$`));
    expect((guardSql(`SELECT 1 FROM raw_logs WHERE chain_id = 43114 AND block_time >= now() - INTERVAL 1 HOUR AND ${'1 + '.repeat(3200)}1 = 1`, 43114) as { error: string }).error).toBe(`query too long (${QUERY_CHARS} chars max)`);
  });
});

describe("a swap's fee", () => {
  const FEES = ' SELECT protocol, version, uniqExact(tx, pool) AS swaps, uniqExactIf(tx, pool, usd IS NOT NULL) AS priced_swaps, round(sum(usd), 2) AS volume_usd, round(sum(fee_usd), 2) AS fees_usd, uniqExactIf(tx, pool, fee_usd IS NULL) AS swaps_not_counted, round(100 * sum(fee_usd) / nullIf(sum(sum(fee_usd)) OVER (), 0), 2) AS share_pct FROM legs GROUP BY protocol, version ORDER BY fees_usd DESC';
  const IN = " SELECT lower(concat('0x', hex(token_in))) AS token_address, sum(fee_in) AS fee_raw, round(sum(fee_usd), 2) AS fees_usd FROM legs GROUP BY token_in";

  it('is read only by a query that reads it, and its token only by one that reads that', () => {
    const plain = expanded(`$DEX(${today})${OWN}`);
    const fee = expanded(`$DEX(${today})${FEES}`);
    const tokenIn = expanded(`$DEX(${today})${IN}`);
    expect(plain).not.toMatch(/fees AS \(|fee_rate|AS tin\b/);
    expect(fee).toContain('ASOF LEFT JOIN fees AS c ON s.pool = c.pool AND s.block_number >= c.block_number');
    expect(fee).toContain('AS fee_rate, usd * fee_rate AS fee_usd FROM swap_logs');
    expect(fee).not.toMatch(/AS tin\b|token_in/);
    expect(tokenIn).toContain(' AS tin FROM raw_logs');
    expect(tokenIn).toContain('if(s.tin, ifNull(s.wt1, p.pt1), ifNull(s.wt0, p.pt0)) AS token_in, if(s.tin, s.r1, s.r0) * fee_rate AS fee_in FROM swap_logs');
    // every fee a pool set, from the first day, by the two events that set one
    expect(fee).toMatch(/fees AS \(SELECT substring\(address, 1, 20\) AS pool, block_number, .* AND block_time >= '2020-09-23' AND topic0 IN \(unhex\('0cba8718[0-9a-f]{56}'\), unhex\('598b9f04[0-9a-f]{56}'\)\)\)/);
  });

  it("takes its rate from its Swap log, else the fee its pool last set, else its pool's tier, else a univ2 pair's 0.3%", () => {
    expect(expanded(`$DEX(${today})${FEES}`)).toContain(
      `multiIf(s.fr IS NOT NULL, s.fr, c.block_number > 0, c.fee / 1e6, p.k > 0, p.k / 1e6, p.protocol IN (${V2_FEE_PROTOCOLS.map((x) => `'${x}'`).join(', ')}), 0.003, NULL) AS fee_rate`,
    );
    // a protocol with 0.3% pairs has one univ2 factory, and its others give each pool a tier or each log a rate, so its k = 0 pools are those pairs
    for (const protocol of V2_FEE_PROTOCOLS) {
      const own = DEX_FACTORIES.filter((f) => f.protocol === protocol);
      expect(own.filter((f) => f.family === 'univ2'), protocol).toHaveLength(1);
      for (const f of own) expect(['univ2', 'univ3', 'cl-ramses', 'lb', 'univ4', 'woofi'], `${protocol} ${f.version}`).toContain(f.family);
    }
  });

  it('fits the query service with every factory, for a fees query that carries what its note needs', async () => {
    for (const sql of [`$DEX(toMonday(now()))${FEES}`, `$DEX(toMonday(now()))${IN}`]) {
      const g = guardSql(sql, 43114);
      expect(g.ok ? '' : g.error).toBe('');
      if (!g.ok) continue;
      const out = await withSources(g.sql, 43114);
      expect(Buffer.byteLength(out.sql)).toBeLessThanOrEqual(SQL_BUDGET);
      const factories = out.sources.find((s) => s.table === 'dex_factories');
      expect(factories?.known, sql.slice(0, 60)).toBe(DEX_FACTORIES.length);
    }
  });

  it('goes back to its shorthand in an earlier turn, in each of its forms', () => {
    for (const rest of [OWN, FEES, IN]) {
      for (const call of [`$DEX(${today})`, `$DEX(${today}, now(), '${slug}')`]) {
        const g = guardSql(call + rest, 43114);
        expect(g.ok, call + rest).toBe(true);
        if (g.ok) expect(collapseMacros(g.sql, 43114)).toBe(`${call + rest}\nLIMIT 2000`);
      }
    }
  });
});

describe('the checks that stop a wrong answer', () => {
  const HASH = "SELECT hex(unhex(transaction_hash)) AS tx_hash FROM raw_logs WHERE chain_id = 43114 AND block_time >= now() - INTERVAL 1 HOUR";

  it('refuse hex(unhex(x)) on bytes, on every chain but Fuji', () => {
    for (const [chainId, sql] of [
      [43114, HASH],
      [432204, HASH.replace('43114', '432204')],
      [1, "SELECT lower(hex(unhex(tx_id))) AS tx FROM decoded_p_txs WHERE chain_id = 1 AND block_time >= now() - INTERVAL 1 DAY"],
    ] as const) {
      const g = guardSql(sql, chainId);
      expect(g.ok ? '' : g.error).toBe("hex(unhex(x)) garbles x: hashes, addresses and topics are bytes already, so write lower(concat('0x', hex(x)))");
    }
    expect(guardSql(HASH.replace('43114', '43113'), 43113).ok).toBe(true);
    expect(guardSql("SELECT concat('0x', hex(transaction_hash)) AS tx_hash FROM raw_logs WHERE chain_id = 43114 AND block_time >= now() - INTERVAL 1 HOUR AND topic0 = unhex('ddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef')", 43114).ok).toBe(true);
  });

  it('refuse startsWith on a hash, and take a range on the hash raw_txs sorts by as its bound, on every chain but Fuji', () => {
    const error = (sql: string, chainId = 43114) => {
      const g = guardSql(sql, chainId);
      return g.ok ? '' : g.error;
    };
    // over 7 days of raw_txs, startsWith(hash, unhex('12')) in a filter kept 3,781 of the 13,452 rows its range keeps
    for (const col of ['hash', 't.hash', 'tx_hash', 'transaction_hash', 'topic0'])
      expect(error(`SELECT count() AS n FROM raw_txs AS t WHERE chain_id = 43114 AND block_time >= now() - INTERVAL 1 DAY AND startsWith(${col}, unhex('12'))`), col).toMatch(/^startsWith on a hash misses rows in a filter/);
    const range = "SELECT count() AS n FROM raw_txs WHERE chain_id = 43114 AND hash >= unhex('12') AND hash < unhex('13')";
    expect(error(range)).toBe('');
    expect(error(range.replace(/\bhash\b/g, 'tx_hash').replace('raw_txs', 'raw_traces'))).toBe('');
    expect(error(range.replace(/hash >= unhex\('12'\)/, "t.hash >= unhex('1230')").replace(/hash < unhex\('13'\)/, "t.hash < unhex('1240')").replace('raw_txs', 'raw_txs AS t'))).toBe('');
    // raw_logs is not sorted by its transaction's hash, and one end of a range bounds nothing
    expect(error(range.replace(/\bhash\b/g, 'transaction_hash').replace('raw_txs', 'raw_logs'))).toBe('bound raw_logs on block_time or block_number (for example block_time >= now() - INTERVAL 1 DAY)');
    expect(error("SELECT count() AS n FROM raw_txs WHERE chain_id = 43114 AND hash >= unhex('12')")).toBe(
      `bound raw_txs on block_time or block_number (for example block_time >= now() - INTERVAL 1 DAY), or raw_txs on a range of its hash (${HASH_RANGE})`,
    );
    // a join bounds every wide table it reads
    expect(error("SELECT count() AS n FROM raw_txs AS t INNER JOIN raw_logs AS l ON l.transaction_hash = t.hash WHERE t.chain_id = 43114 AND l.chain_id = 43114 AND t.hash >= unhex('12') AND t.hash < unhex('13')")).toMatch(/^bound raw_txs, raw_logs on block_time or block_number/);
    // Fuji keeps its rules
    expect(error(range.replace('43114', '43113'), 43113)).toBe('bound raw_txs on block_time or block_number (for example block_time >= now() - INTERVAL 1 DAY)');
    expect(error("SELECT count() AS n FROM raw_txs WHERE chain_id = 43113 AND block_time >= now() - INTERVAL 1 DAY AND startsWith(hash, unhex('12'))", 43113)).toBe('');
  });

  it('refuse a $DEX query that reads the Swap logs from raw_logs again or joins raw_logs to legs, and pass a read of another event', () => {
    const error = (sql: string) => {
      const g = guardSql(sql, 43114);
      return g.ok ? '' : g.error;
    };
    const t = (k: keyof typeof DEX_TOPICS) => `unhex('${DEX_TOPICS[k]}')`;
    const from = `l.chain_id = 43114 AND l.block_time >= ${today}`;
    // a replay of D07 ("The largest swaps today") joined the Swap logs back to legs on tx and pool, so an lb swap that
    // crossed n bins came back n times n
    const d07 = `$DEX(${today}) SELECT lower(concat('0x', hex(l.transaction_hash))) AS tx_hash, l.block_time AS t, l.block_number, lower(concat('0x', hex(l.tx_from))) AS trader, lower(concat('0x', hex(l.address))) AS pool, legs.protocol, legs.version, legs.usd AS volume_usd FROM raw_logs AS l INNER JOIN legs ON l.transaction_hash = legs.tx AND l.address = legs.pool WHERE ${from} AND l.topic0 IN (${t('v2Swap')}, ${t('v3Swap')}, ${t('lbSwap')}, ${t('v4Swap')}) ORDER BY legs.usd DESC LIMIT 20`;
    const again = error(d07);
    expect(again).toMatch(/^this \$DEX query reads the window's Swap logs from raw_logs again, and legs holds them already, one row per log\. /);
    expect(again).toContain("legs has pool, block_time, block_number, tx (the log's transaction_hash), trader (its tx_from), router (its tx_to), protocol, version, t0, t1, k, r0, r1 and usd: read them FROM legs alone");
    expect(error(`$DEX(${today}) SELECT count() AS logs FROM raw_logs AS l WHERE ${from} AND l.topic0 IN (v2_swap, v3_swap, lb_swap, v4_swap)`)).toBe(again);
    // WOOFi's WooSwap is in legs too, so a WOOFi row read beside the other protocols counts its swaps twice
    expect(error(`$DEX(${today}) SELECT protocol, round(sum(usd), 2) AS volume_usd FROM legs GROUP BY protocol UNION ALL SELECT 'woofi' AS protocol, round(sum(toFloat64(reinterpretAsUInt256(reverse(substring(l.data, 129, 32)))) / 1e6), 2) AS volume_usd FROM raw_logs AS l WHERE ${from} AND l.topic0 = ${t('wooSwap')}`)).toBe(again);
    // a join of another event's logs to legs repeats each swap as well
    const joined = error(`$DEX(${today}) SELECT legs.tx, round(sum(legs.usd), 2) AS volume_usd FROM legs INNER JOIN raw_logs AS l ON l.transaction_hash = legs.tx WHERE ${from} AND l.topic0 = ${t('transfer')} GROUP BY legs.tx`);
    expect(joined).toMatch(/^this \$DEX query joins raw_logs to legs, so each swap comes back once for every log it matches .* filter legs with tx IN \(SELECT transaction_hash FROM raw_logs WHERE …\) or pool IN \(SELECT …\)$/);
    expect(error(`$DEX(${today}) SELECT count() AS n FROM default.raw_logs AS l INNER JOIN swap_logs AS s ON l.transaction_hash = s.tx WHERE ${from} AND l.topic0 = ${t('transfer')}`)).toBe(joined);
    for (const ok of [
      // the swaps of the transactions another event names, and a count per pool of another event joined on the pool
      `$DEX(${today}) SELECT count() AS swaps FROM legs WHERE tx IN (SELECT transaction_hash FROM raw_logs AS l WHERE ${from} AND l.topic0 = ${t('transfer')})`,
      `$DEX(${today}), syncs AS (SELECT l.address AS pool_address, count() AS n FROM raw_logs AS l WHERE ${from} AND l.topic0 = ${t('v2Sync')} GROUP BY pool_address) SELECT g.pool, round(sum(g.usd), 2) AS volume_usd, any(y.n) AS syncs FROM legs AS g INNER JOIN syncs AS y ON g.pool = y.pool_address GROUP BY g.pool`,
      // a drill into the Swap logs themselves, and legs joined to itself
      `$POOLS() SELECT l.block_time AS t FROM raw_logs AS l WHERE ${from} AND l.topic0 IN (v2_swap, v3_swap, lb_swap, v4_swap) AND if(l.topic0 = v4_swap, l.topic1, l.address) IN (SELECT pool FROM pools) ORDER BY l.block_time DESC LIMIT 50`,
      `$DEX(${today}) SELECT a.tx, count() AS hops FROM legs AS a INNER JOIN legs AS b ON a.tx = b.tx GROUP BY a.tx`,
    ])
      expect(error(ok), ok).toBe('');
  });

  it('name a fee, a volume, a price or a USD value below zero, but not a net, a flow or a change', () => {
    const rows = (name: string, v: unknown) => ({ columns: [{ name: 'protocol' }, { name }], rows: [{ protocol: 'a', [name]: 12.5 }, { protocol: 'b', [name]: v }] });
    expect(negativeFigure(rows('fees_usd', -375.21), 43114)).toBe(
      "fees_usd is -375.21 in row 2, and a fee, a volume, a price or a value in USD is never below zero, so a sign in the query is wrong. Do not hide it with abs(): find the step that turns it negative. A univ3 Swap's amount0 and amount1 have opposite signs, so a price from them is -amount1 / amount0. In a DEX query, a swap's value is usd in legs, the WAVAX price of an hour is price in px, and a pair's own price is the ratio of r0 and r1 over that pair's legs only. Then call render_chart again.",
    );
    for (const name of ['volume_usd', 'price', 'lp_fees', 'usd', 'tvl_usd', 'fees_avax']) expect(negativeFigure(rows(name, -1), 43114)).toMatch(new RegExp(`^${name} is -1 in row 2`));
    for (const name of ['net_flow_usd', 'net_usd', 'usd_change', 'share_pct', 'pnl_usd', 'outflow_usd', 'count']) expect(negativeFigure(rows(name, -1), 43114)).toBeNull();
    for (const v of [null, 0, '12', 'abc', '0x00']) expect(negativeFigure(rows('volume_usd', v), 43114)).toBeNull();
    expect(negativeFigure(rows('volume_usd', '-3'), 432204)).toMatch(/^volume_usd is -3 in row 2/);
    expect(negativeFigure(rows('volume_usd', -3), 43113)).toBeNull();
    expect(negativeFigure(rows('volume_usd', -3), 5)).toBeNull();
  });
});

describe('the date and the calendar', () => {
  const at = new Date(Date.UTC(2026, 8, 27, 23, 30));

  it("give the writer today's date in its turn, on every chain but Fuji", () => {
    for (const chainId of [43114, 432204, 1]) expect(userTurn(chainId, 'Uniswap volume on September 26', at)).toBe('Today is 2026-09-27 (UTC).\n\nUniswap volume on September 26');
    for (const chainId of [43113, 5]) expect(userTurn(chainId, 'Uniswap volume on September 26', at)).toBe('Uniswap volume on September 26');
  });

  it('say this week starts on Monday and a named day has the year of today, and leave Fuji its line', () => {
    const c = (chainId: number, dex = false) => systemPrompt({ chainId, chainName: 'x', symbol: 'AVAX', schema: '', coverage: null, dex });
    const p = (chainId: number) => pchainPrompt({ chainId, network: '', schema: '', coverage: null, lines: null });
    for (const text of [c(43114), c(43114, true), c(432204), p(1)]) {
      expect(text).toContain('A calendar window never starts earlier: this week is never toMonday(now()) - INTERVAL 7 DAY.');
      expect(text).toContain('Write these windows with now(), and in the note in words ("since Monday"), never with today\'s date or a date written out (not toMonday(toDateTime(\'2022-03-09\'))): a kept answer and its note are shown again on later days.');
      expect(text).toContain("in the year of today's date (the question's first line) unless it names another");
    }
    for (const text of [c(43113), p(5)]) {
      expect(text).toContain('- Calendar words are calendar windows: "today" starts at toStartOfDay(now()), "this week" at toMonday(now()), "this month" at toStartOfMonth(now()), "this year" at toStartOfYear(now()). "The last 30 days" (24 hours, 7 days) is a rolling window from now() - INTERVAL 30 DAY.\n');
      expect(text).not.toContain('never starts earlier');
    }
    // no example starts a calendar week earlier than its Monday
    const dex = c(43114, true);
    const examples = dex.split('\n').filter((l) => /^(WITH|SELECT|\$DEX\(|\$POOLS\(|drill: )/.test(l));
    expect(examples.length).toBeGreaterThan(20);
    for (const l of examples) expect(l).not.toMatch(/toMonday\(now\(\)\) - INTERVAL \d+ DAY/);
    expect(dex).toContain("$DEX(toMonday(now()), 'pharaoh') SELECT toDate(block_time) AS t,");
  });

  it('tell a DEX question to type the shorthand, take prices from the WITH, and count a token once per swap', () => {
    const dex = systemPrompt({ chainId: 43114, chainName: 'x', symbol: 'AVAX', schema: '', coverage: null, dex: true });
    expect(dex).toContain("Never write it out, or a shorter copy of it: open every such query with $DEX(start), $DEX(start, end), or either with a slug last ($DEX(start, 'slug'), $DEX(start, end, 'slug')), even one that needs no value.");
    // a date years from any window a question asks about, so a copy of it never passes as the question's own
    expect(dex).toContain("$DEX(toDateTime('2022-03-07 00:00:00'), toDateTime('2022-03-08 00:00:00'), 'trader-joe') is Monday March 7, 2022");
    expect(dex).not.toMatch(/toDateTime\('202[5-9]-/);
    expect(dex).toContain('legs has one row per Swap log (an lb swap that crosses n bins is n rows): pool, block_time, block_number, tx, trader, router, protocol, version, t0, t1, k, r0, r1 and usd, and no chain_id');
    expect(dex).toContain('Never join raw_logs back to legs');
    expect(dex).toContain('Per DEX or per protocol means every protocol: GROUP BY protocol (and the bucket), one row each. Never a column per protocol');
    expect(dex).toContain(`"Uniswap v3" is protocol = 'uniswap' AND version = 'v3'.`);
    expect(dex).toContain('Never price a swap again in a query of your own.');
    const rule = /FROM legs ARRAY JOIN (\[.*?\]) AS token\./.exec(dex);
    expect(rule).not.toBeNull();
    const g = guardSql(`$DEX(${today}) SELECT lower(concat('0x', hex(token))) AS token_address, uniqExact(tx, pool) AS swaps, round(sum(usd), 2) AS volume_usd FROM legs ARRAY JOIN ${rule![1]} AS token GROUP BY token ORDER BY volume_usd DESC LIMIT 15`, 43114);
    expect(g.ok ? '' : g.error).toBe('');
  });
});

describe('a relative window written as a date', () => {
  const at = new Date(Date.UTC(2026, 8, 27, 23, 30));
  const DAY_SQL = "$DEX(toDateTime('2026-09-27 00:00:00')) SELECT protocol, round(sum(usd), 2) AS volume_usd FROM legs GROUP BY protocol";

  it('is sent back once with the now() forms, when no turn names a date', () => {
    expect(literalWindow(DAY_SQL, 'What is the volume per DEX today?', 43114, at)).toBe(
      'the query writes the date 2026-09-27 out, and the question names no date. Write its window with now(): today is toStartOfDay(now()), this week toMonday(now()), this month toStartOfMonth(now()), the last 7 days now() - INTERVAL 7 DAY. A kept answer runs again on later days, and a date written out would read the same days. Then call render_chart again.',
    );
    expect(literalWindow("SELECT 1 FROM raw_logs WHERE block_time >= toMonday(toDateTime('2026-09-21'))", 'LP fees this week', 432204, at)).toMatch(/^the query writes the date 2026-09-21 out/);
    expect(literalWindow("SELECT 1 FROM raw_logs WHERE block_time >= '2026-09-01 00:00:00'", 'Who are the top liquidators this month?', 43114, at)).toMatch(/^the query writes the date 2026-09-01 out/);
  });

  it('stays when a turn names a day, a month or a year, when the date is old, and on Fuji', () => {
    for (const q of ['Uniswap volume by version on September 26', 'volume in the week of Monday September 21', 'volume on 26 Sep', 'volume on 9/26', 'volume since 2026-09-20', 'swaps in 2026', 'volume in May']) expect(literalWindow(DAY_SQL, q, 43114, at)).toBeNull();
    expect(literalWindow(DAY_SQL, 'Uniswap volume by version on September 26\nsplit it per hour', 43114, at)).toBeNull();
    expect(literalWindow("$DEX(toDateTime('2026-08-01 00:00:00')) SELECT count() AS n FROM legs", 'swaps per day', 43114, at)).toBeNull();
    expect(literalWindow(`$POOLS() SELECT count() AS pools FROM pools`, 'how many pools', 43114, at)).toBeNull();
    expect(literalWindow(expanded(DAY_SQL.replace("toDateTime('2026-09-27 00:00:00')", 'toStartOfDay(now())')), 'What is the volume per DEX today?', 43114, at)).toBeNull();
    for (const chainId of [43113, 5]) expect(literalWindow(DAY_SQL, 'What is the volume per DEX today?', chainId, at)).toBeNull();
  });
});
