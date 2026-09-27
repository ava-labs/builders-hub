import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { recipeKey } from '@/lib/explorer-query/cache';
import { guardSql } from '@/lib/explorer-query/guard';
import { pchainPrompt, promptVersion, systemPrompt } from '@/lib/explorer-query/prompt';
import { refSchema, SQL_BUDGET } from '@/lib/explorer-query/sources';

const PRIMARY = '11111111111111111111111111111111LpoYY';
const B58 = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
const b58 = (i: number, n: number) => Array.from({ length: n }, (_, k) => B58[Math.floor(i / 58 ** k) % 58]).join('');
/** a CB58-shaped subnet id and a node id per index */
const subnetId = (i: number) => `${b58(i, 2)}${'Xy7'.repeat(15)}zz`;
const nodeId = (set: string, i: number) => `NodeID-${set}${b58(i, 3)}${'Q'.repeat(28)}`;
const DAY = 86_400_000;
const VERSIONS = 'SELECT subnet_id, version, sum(seats) AS validators FROM p_validator_versions WHERE chain_id = 1 GROUP BY subnet_id, version';

interface Seat {
  nodeId: string;
  subnetId: string;
  weight: string;
  remainingBalance?: string;
  totalStake?: string;
  version?: string;
}
interface Net {
  primary: Seat[];
  l1: Seat[];
  crawler: { nodeId: string; version: string; lastSeenOnline: number }[] | null;
  /** the validator feed's names, and the registry's subnets with their chains */
  stats?: { id: string; name: string }[];
  subnets?: { subnetId: string; blockchains: { blockchainName?: string; createBlockTimestamp?: number }[] }[];
}

const now = Date.now();
const seat = (s: Partial<Seat> & Pick<Seat, 'nodeId' | 'subnetId'>): Seat => ({ weight: '100', remainingBalance: '5000000000', ...s });

function mainnet(): Net {
  const primary = Array.from({ length: 607 }, (_, i) => ({ nodeId: nodeId('P', i), subnetId: PRIMARY, weight: '2000000000000', totalStake: '2500000000000', version: i < 590 ? 'avalanchego/1.15.2' : undefined }));
  const l1 = [
    ...Array.from({ length: 230 }, (_, i) => seat({ nodeId: nodeId('L', i), subnetId: subnetId(1) })),
    // inactive seats are not in the set, as on the validator pages
    ...Array.from({ length: 3 }, (_, i) => seat({ nodeId: nodeId('D', i), subnetId: subnetId(1), remainingBalance: '0' })),
    ...Array.from({ length: 2 }, (_, i) => seat({ nodeId: nodeId('W', i), subnetId: subnetId(1), weight: '0' })),
    // ids go into SQL text; anything that is not CB58 is dropped
    ...Array.from({ length: 5 }, (_, i) => seat({ nodeId: nodeId('X', i), subnetId: "x') UNION ALL SELECT 1 --" })),
  ];
  const crawler = [
    // our nodes' version wins over the crawler's
    { nodeId: nodeId('P', 0), version: 'avalanchego/1.13.0', lastSeenOnline: now - 30 * DAY },
    ...Array.from({ length: 110 }, (_, i) => ({
      nodeId: nodeId('L', i),
      version: i < 60 ? 'avalanchego/1.14.1' : 'avalanchego/1.15.0',
      lastSeenOnline: now - (i < 40 ? 3600_000 : i < 70 ? 3 * DAY : 20 * DAY),
    })),
  ];
  return { primary, l1, crawler };
}

function fuji(): Net {
  const primary = Array.from({ length: 600 }, (_, i) => ({ nodeId: nodeId('F', i), subnetId: PRIMARY, weight: '2000000000000', version: 'avalanchego/1.15.2' }));
  // 400 L1s, too many for one query: the largest first
  const l1 = Array.from({ length: 400 }, (_, i) => Array.from({ length: i < 10 ? 20 : 3 }, (_, k) => seat({ nodeId: nodeId('G', i * 20 + k), subnetId: subnetId(i) }))).flat();
  return { primary, l1, crawler: [] };
}

/** the module with no feed read yet: each test reads the feeds it set up */
async function fresh() {
  vi.resetModules();
  return import('@/lib/explorer-query/sources');
}

let nets: Record<string, Net>;
let calls: string[];
/** set, the registry's answer waits for it */
let registryGate: Promise<void> | null;

function route(url: string): Response {
  const u = new URL(url);
  calls.push(u.pathname);
  const net = (u.hostname.includes('discovery-fuji') || u.pathname.includes('/fuji') ? 'fuji' : 'mainnet') as 'mainnet' | 'fuji';
  if (u.hostname.includes('validator-discovery')) {
    const c = nets[net].crawler;
    return c ? Response.json(c) : new Response('down', { status: 503 });
  }
  if (/^\/api\/(mainnet|fuji)\/validators$/.test(u.pathname)) return Response.json({ validators: nets[net].primary });
  if (/^\/v1\/networks\/(mainnet|fuji)\/l1Validators$/.test(u.pathname)) {
    const from = Number(u.searchParams.get('pageToken') ?? 0);
    const page = nets[net].l1.slice(from, from + 100);
    return Response.json({ validators: page, ...(from + 100 < nets[net].l1.length ? { nextPageToken: String(from + 100) } : {}) });
  }
  if (u.pathname === '/api/validator-stats') return Response.json(nets[net].stats ?? []);
  if (/^\/v1\/networks\/(mainnet|fuji)\/subnets$/.test(u.pathname)) return Response.json({ subnets: nets[net].subnets ?? [] });
  if (u.pathname === '/api/avax-supply') {
    return Response.json({ totalSupply: '467980000.5', circulatingSupply: '420000000', totalStaked: '221000000', totalLocked: '1000', totalRewards: '9000', totalPBurned: '1', totalCBurned: '4500000', totalXBurned: '2', l1ValidatorFees: '18151.28', genesisUnlock: '3', lastUpdated: '2026-09-27T04:30:17.000Z' });
  }
  return new Response('not found', { status: 404 });
}

beforeEach(() => {
  nets = { mainnet: mainnet(), fuji: fuji() };
  calls = [];
  registryGate = null;
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => {
      if (registryGate && new URL(String(url)).pathname.endsWith('/subnets')) await registryGate;
      return route(String(url));
    }),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('guard', () => {
  it('lets the P-Chain read p_validator_versions with no time bound, and no EVM chain', () => {
    expect(guardSql(VERSIONS, 1).ok).toBe(true);
    expect(guardSql(VERSIONS.replace('chain_id = 1', 'chain_id = 43114'), 43114).ok).toBe(false);
  });

  it('keeps the one-chain rule, and a WITH may not take the name of a table the server defines', () => {
    expect(guardSql(VERSIONS.replace('chain_id = 1', 'chain_id = 5'), 1).ok).toBe(false);
    expect(guardSql('WITH p_validator_versions AS (SELECT 1 AS x) SELECT x FROM p_validator_versions WHERE chain_id = 1', 1).ok).toBe(false);
    expect(guardSql('WITH decoded_p_txs AS (SELECT 1 AS x) SELECT x FROM decoded_p_txs WHERE chain_id = 1', 1).ok).toBe(false);
    expect(guardSql('SELECT * FROM default.p_validator_versions WHERE chain_id = 1', 1).ok).toBe(false);
  });

  it('drops a FINAL after a table the server deduplicates, and leaves the rest', () => {
    const cases: [string, string][] = [
      ['FROM decoded_p_txs FINAL WHERE', 'FROM decoded_p_txs WHERE'],
      ['FROM decoded_p_txs AS d FINAL WHERE', 'FROM decoded_p_txs AS d WHERE'],
      ['FROM p_utxos_spent s final WHERE', 'FROM p_utxos_spent s WHERE'],
    ];
    for (const [written, sent] of cases) {
      const g = guardSql(`SELECT count() ${written} chain_id = 1 AND block_time >= now() - INTERVAL 1 DAY`, 1);
      expect(g.ok && g.sql).toContain(sent);
    }
    const other = guardSql('SELECT count() FROM p_validator_snapshots FINAL WHERE chain_id = 1 AND snapshot_time >= now() - INTERVAL 1 DAY', 1);
    expect(other.ok && other.sql).toContain('p_validator_snapshots FINAL');
  });

  it('reads WITH FILL FROM as a value, not a table', () => {
    const g = guardSql("SELECT toMonday(block_time) AS t, count() AS txs FROM decoded_p_txs WHERE chain_id = 1 AND block_time >= toMonday(now()) - INTERVAL 12 WEEK GROUP BY t ORDER BY t WITH FILL FROM toMonday(now()) - INTERVAL 12 WEEK TO toMonday(now()) + INTERVAL 1 WEEK STEP INTERVAL 1 WEEK", 1);
    expect(g.ok).toBe(true);
    expect(guardSql('SELECT count() FROM decoded_p_txs WHERE chain_id = 1 AND block_time >= now() - INTERVAL 1 DAY UNION ALL SELECT count() FROM p_node_info_x WHERE chain_id = 1', 1).ok).toBe(false);
  });

  it('gives Fuji no supply table: the Data API counts mainnet only', () => {
    const sql = 'SELECT total_supply_avax FROM p_avax_supply WHERE chain_id = ';
    expect(guardSql(`${sql}1`, 1).ok).toBe(true);
    expect(guardSql(`${sql}5`, 5).ok).toBe(false);
    expect(refSchema(1).map((l) => l.split('(')[0])).toEqual(['p_validator_versions', 'p_avax_supply']);
    expect(refSchema(5).map((l) => l.split('(')[0])).toEqual(['p_validator_versions']);
  });
});

describe('withSources', () => {
  it('sends a query that reads no server table unchanged', async () => {
    const sql = 'SELECT count() FROM p_validator_snapshots WHERE chain_id = 1 AND snapshot_time >= now() - INTERVAL 1 DAY';
    expect(await (await fresh()).withSources(sql, 1)).toEqual({ sql, sources: [] });
    const evm = 'SELECT count() FROM raw_txs WHERE chain_id = 43114 AND block_time >= now() - INTERVAL 1 DAY';
    expect(await (await fresh()).withSources(evm, 43114)).toEqual({ sql: evm, sources: [] });
    expect(calls).toEqual([]);
  });

  it('reads the tables with duplicate rows through FINAL, under their own names', async () => {
    const sql = 'SELECT tx_type, count() AS txs FROM decoded_p_txs WHERE chain_id = 1 AND block_time >= now() - INTERVAL 7 DAY GROUP BY tx_type';
    const out = await (await fresh()).withSources(sql, 1);
    expect(out.sql).toBe(`WITH decoded_p_txs AS (SELECT * FROM decoded_p_txs FINAL) SELECT * FROM (\n${sql}\n)`);
    expect(out.sources).toEqual([]);
    const both = await (await fresh()).withSources('SELECT count() FROM p_utxos_created AS c LEFT JOIN p_utxos_spent AS s ON s.utxo_id = c.utxo_id WHERE c.chain_id = 1 AND c.created_time >= now() - INTERVAL 1 DAY', 1);
    expect(both.sql.startsWith('WITH p_utxos_created AS (SELECT * FROM p_utxos_created FINAL), p_utxos_spent AS (SELECT * FROM p_utxos_spent FINAL) SELECT * FROM (')).toBe(true);
  });

  it('defines the versions in front of the query and states what they cover and how recent they are', async () => {
    const { sql, sources } = await (await fresh()).withSources(VERSIONS, 1);
    expect(sql.startsWith('WITH p_validator_versions AS (SELECT toUInt8(1) AS chain_id,')).toBe(true);
    expect(sql.endsWith(`SELECT * FROM (\n${VERSIONS}\n)`)).toBe(true);
    expect(sql).not.toContain('UNION');
    expect(sql).toContain('AS seen_day');
    expect(sources).toHaveLength(1);
    expect(sources[0]).toMatchObject({ table: 'p_validator_versions', total: 837, known: 700 });
    expect(sources[0].text).toBe(
      'Versions are known for 700 of 837 validator seats: 590 of 607 on the Primary Network, 110 of 230 on L1s. The rest count as Unknown. ' +
        '590 versions are what our nodes saw in the last day. 110 come from a discovery crawler that keeps the last version it saw: 70 of them were seen in the last 7 days.',
    );
  });

  it('says so when the crawler does not answer', async () => {
    nets.mainnet.crawler = null;
    const { sources } = await (await fresh()).withSources(VERSIONS, 1);
    expect(sources[0]).toMatchObject({ total: 837, known: 590 });
    expect(sources[0].text).toContain('The discovery crawler did not answer, so only the versions our nodes saw in the last day are known.');
  });

  it('cuts a set too big for one query to fit, keeps the sets the query names, and says so', async () => {
    const query = `SELECT version, sum(seats) AS validators FROM p_validator_versions WHERE chain_id = 5 AND subnet_id = '${subnetId(399)}' GROUP BY version`;
    const { sql, sources } = await (await fresh()).withSources(query, 5);
    expect(Buffer.byteLength(sql)).toBeLessThanOrEqual(SQL_BUDGET);
    expect(sql).toContain(`'${subnetId(399)}'`);
    expect(sql).toContain(`'${PRIMARY}'`);
    expect(sources[0].text).toMatch(/^This table holds \d+ of 401 validator sets, the ones the query names, then the largest: /);
  });

  it('builds the supply as one row from the Data API, with when it was counted', async () => {
    const query = 'SELECT l1_validator_fees_avax FROM p_avax_supply WHERE chain_id = 1';
    const { sql, sources } = await (await fresh()).withSources(query, 1);
    expect(sql).toContain('toFloat64(18151.28) AS l1_validator_fees_avax');
    expect(sql).toContain("toDateTime('2026-09-27 04:30:17', 'UTC') AS updated_at");
    expect(sources).toEqual([expect.objectContaining({ table: 'p_avax_supply', text: 'Supply figures come from the Avalanche Data API, updated 2026-09-27 04:30 UTC.' })]);
  });
});

describe('subnet names', () => {
  it("takes the validator feed's name first, then the registry's newest named chain", async () => {
    nets.mainnet.stats = [{ id: subnetId(1), name: 'Feed name' }];
    nets.mainnet.subnets = [
      { subnetId: subnetId(1), blockchains: [{ blockchainName: 'Registry name', createBlockTimestamp: 5 }] },
      { subnetId: subnetId(2), blockchains: [{ blockchainName: 'old chain', createBlockTimestamp: 1 }, { blockchainName: 'new chain', createBlockTimestamp: 9 }, { blockchainName: ' ', createBlockTimestamp: 20 }] },
    ];
    const names = await (await fresh()).subnetNames(1);
    expect(names.get(subnetId(1))).toBe('Feed name');
    expect(names.get(subnetId(2))).toBe('new chain');
    expect(names.size).toBe(2);
  });

  it("answers with the feed's names when the registry outlasts the wait, and names the next answer from that same read", async () => {
    nets.mainnet.stats = [{ id: subnetId(1), name: 'Feed name' }];
    nets.mainnet.subnets = [{ subnetId: subnetId(2), blockchains: [{ blockchainName: 'Registry name', createBlockTimestamp: 1 }] }];
    let open!: () => void;
    registryGate = new Promise<void>((resolve) => (open = resolve));
    const { subnetNames } = await fresh();
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    try {
      const first = subnetNames(1);
      await vi.advanceTimersByTimeAsync(3000);
      expect(Object.fromEntries(await first)).toEqual({ [subnetId(1)]: 'Feed name' });
      // the registry answers after the wait ended; the clock stays still, so the next call can only be answered by that read
      open();
      expect(Object.fromEntries(await subnetNames(1))).toEqual({ [subnetId(1)]: 'Feed name', [subnetId(2)]: 'Registry name' });
      expect(Object.fromEntries(await subnetNames(1))).toEqual({ [subnetId(1)]: 'Feed name', [subnetId(2)]: 'Registry name' });
      expect(calls.filter((c) => c.endsWith('/subnets'))).toHaveLength(1);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('prompt', () => {
  it("names a method's contract only when it holds most of the calls, and counts the contracts", () => {
    const text = systemPrompt({ chainId: 43114, chainName: 'Avalanche C-Chain', symbol: 'AVAX', schema: '', coverage: null });
    expect(text).toContain('if(top_calls * 2 > txs, top_contract, NULL) AS contract');
    expect(text).toContain('uniqExact(callee) AS contracts');
    expect(text).not.toContain('anyHeavy');
  });

  it('fills a daily level as empty, not zero, so no line crosses a day with no rows', () => {
    const text = pchainPrompt({ chainId: 1, network: 'mainnet', schema: '', coverage: null, lines: null });
    expect(text).toMatch(/toNullable\(argMax\(supply, block_height\) \/ 1e9\) AS pchain_supply_avax FROM p_exec_state_history .* WITH FILL FROM toDate\(now\(\)\) - INTERVAL 90 DAY/);
    expect(text).toMatch(/toNullable\(argMax\(staked, snapshot_time\)\) AS staked_avax .* WITH FILL FROM/);
  });

  it('reads calendar words as calendar windows, and "the last 30 days" as a rolling one', () => {
    for (const text of [systemPrompt({ chainId: 43114, chainName: 'Avalanche C-Chain', symbol: 'AVAX', schema: '', coverage: null }), pchainPrompt({ chainId: 1, network: 'mainnet', schema: '', coverage: null, lines: null })]) {
      expect(text).toContain('"this month" at toStartOfMonth(now())');
      expect(text).toContain('"The last 30 days" (24 hours, 7 days) is a rolling window from now() - INTERVAL 30 DAY.');
    }
  });

  it('claims no share the rows do not carry, and never calls a sender a contract', () => {
    const text = systemPrompt({ chainId: 43114, chainName: 'Avalanche C-Chain', symbol: 'AVAX', schema: '', coverage: null });
    expect(text).toContain('It claims no share or total ("all", "most", "the majority") that no column of the rows carries, and never calls a transaction\'s sender a contract.');
    expect(text).toContain('is the account that signed it, never a contract');
  });

  it('counts unqualified validators on the Primary Network and the L1s side by side, and keeps server caveats out of notes', () => {
    const text = pchainPrompt({ chainId: 1, network: 'mainnet', schema: '', coverage: null, lines: null });
    expect(text).toContain('never the Primary Network alone');
    expect(text).toMatch(/AS primary_validators, \(SELECT count\(\) FROM p_l1_validator_snapshots WHERE chain_id = 1 AND balance > 0 .* AS l1_validators/);
    expect(text).toContain('passes over a snapshot still being written, so the note never mentions it');
    expect(text).toContain('if(up.observers > 0, round(up.median_uptime, 2), NULL), never 0');
  });

  it('names the base of a share, and makes no hedges or parenthesized filters in a note', () => {
    for (const text of [systemPrompt({ chainId: 43114, chainName: 'Avalanche C-Chain', symbol: 'AVAX', schema: '', coverage: null }), pchainPrompt({ chainId: 1, network: 'mainnet', schema: '', coverage: null, lines: null })]) {
      expect(text).toContain('A share names the base its SQL divides by ("of the method calls counted", not "of all transactions").');
      expect(text).toContain('It makes no hedges ("may", "might", "could", "likely", "appears") and never repeats a filter in parentheses such as "(balance > 0)"');
    }
  });

  it('stops a fill at the bucket after now, keeps notes on the data, and bans the finality words', () => {
    const evm = systemPrompt({ chainId: 43114, chainName: 'Avalanche C-Chain', symbol: 'AVAX', schema: '', coverage: null });
    const pchain = pchainPrompt({ chainId: 1, network: 'mainnet', schema: '', coverage: null, lines: null });
    expect(evm).toContain("A fill's TO, when it has one, is the bucket after now, never later");
    expect(pchain).toContain('never the end of a calendar window such as this month: a fill adds no day that has not begun');
    for (const text of [evm, pchain]) {
      expect(text).toContain('It describes the data, never the server, the engine or the query');
      expect(text).toContain('Never write "settled", "waiting" or "pending", in any sense.');
    }
  });

  it('returns the largest fee with its transaction, and lets an L1 say burned only when every block burns', () => {
    const cchain = systemPrompt({ chainId: 43114, chainName: 'Avalanche C-Chain', symbol: 'AVAX', schema: '', coverage: null });
    const l1 = systemPrompt({ chainId: 432204, chainName: 'Dexalot', symbol: 'ALOT', schema: '', coverage: null });
    for (const text of [cchain, l1]) {
      expect(text).toContain("concat('0x', lower(hex(argMax(hash, toFloat64(gas_used) * gas_price)))) AS max_fee_tx, count() AS txs FROM raw_txs");
      expect(text).toContain("concat('0x', lower(hex(argMax(hash, gas_used)))) AS max_gas_tx");
    }
    expect(l1).toContain("countIf(miner != unhex('0100000000000000000000000000000000000000')) AS not_burned FROM raw_blocks WHERE chain_id = 432204 AND block_time >= toStartOfHour(now()) - INTERVAL 24 HOUR\nThen render_chart with the fee query");
    expect(l1).toContain('say "fees paid", never "burned". A fee question also reads raw_blocks.miner over the same window');
    expect(l1).toContain('to the burn address when not_burned is 0');
    expect(l1).toContain('The one exception is a fee question: call run_sql first with the check of where the fees went, as the worked example "Fees per bucket" shows');
    expect(cchain).not.toContain('The one exception is a fee question');
    expect(cchain).not.toContain('not_burned');
  });

  it('gives a refusal a title that names no topic', () => {
    for (const text of [systemPrompt({ chainId: 43114, chainName: 'Avalanche C-Chain', symbol: 'AVAX', schema: '', coverage: null }), pchainPrompt({ chainId: 1, network: 'mainnet', schema: '', coverage: null, lines: null })]) {
      expect(text).toContain('With kind "none" the title is "No chart for this question", whatever the question is about');
    }
  });
});

describe('prompt version', () => {
  it('is stable, differs per target, and does not follow the live version lines', () => {
    const v = promptVersion(1);
    expect(v).toMatch(/^[0-9a-f]{12}$/);
    expect(promptVersion(1)).toBe(v);
    expect(new Set([v, promptVersion(5), promptVersion(43114), promptVersion(432204)]).size).toBe(4);
    expect(recipeKey(1, 'L1s by version?')).toBe(recipeKey(1, 'l1s  by VERSION'));
    expect(pchainPrompt({ chainId: 1, network: '', schema: '', coverage: null, lines: ['1.16', '1.15'] })).toContain('Version lines in the set now: 1.16, 1.15.');
  });

  it('tells Fuji of no supply table, and mainnet of it', () => {
    const fujiText = pchainPrompt({ chainId: 5, network: 'fuji', schema: '', coverage: null, lines: null });
    const mainText = pchainPrompt({ chainId: 1, network: 'mainnet', schema: '', coverage: null, lines: null });
    expect(fujiText).not.toContain('p_avax_supply');
    expect(mainText).toContain('p_avax_supply.l1_validator_fees_avax');
    expect(fujiText).toContain('On Fuji, ConvertSubnetToL1Tx rows carry no l1_validation_ids');
  });
});
