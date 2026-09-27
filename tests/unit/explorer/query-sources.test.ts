import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { recipeKey } from '@/lib/explorer-query/cache';
import { guardSql } from '@/lib/explorer-query/guard';
import { pchainPrompt, promptVersion } from '@/lib/explorer-query/prompt';
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
  if (u.pathname === '/api/avax-supply') {
    return Response.json({ totalSupply: '467980000.5', circulatingSupply: '420000000', totalStaked: '221000000', totalLocked: '1000', totalRewards: '9000', totalPBurned: '1', totalCBurned: '4500000', totalXBurned: '2', l1ValidatorFees: '18151.28', genesisUnlock: '3', lastUpdated: '2026-09-27T04:30:17.000Z' });
  }
  return new Response('not found', { status: 404 });
}

beforeEach(() => {
  nets = { mainnet: mainnet(), fuji: fuji() };
  calls = [];
  vi.stubGlobal('fetch', vi.fn(async (url: string) => route(String(url))));
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
