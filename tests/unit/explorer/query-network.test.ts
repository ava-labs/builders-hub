import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { recipeKey } from '@/lib/explorer-query/cache';
import { mixedChains } from '@/lib/explorer-query/checks';
import { figures } from '@/lib/explorer-query/visual';
import { guardSql } from '@/lib/explorer-query/guard';
import { networkPrompt, networkVersion } from '@/lib/explorer-query/network-prompt';
import { promptVersion } from '@/lib/explorer-query/prompt';
import { NETWORK_ID, NETWORK_SLUG, rowBase, targetOf } from '@/lib/explorer-query/target';

/* The network target: the C-Chain and every mainnet L1 stats-api indexes, asked as one. The server reads each table
   as those chains' rows alone, so the target reads no Fuji, testnet or unlisted chain whatever its SQL writes. */

const W = 'block_time >= now() - INTERVAL 1 DAY';
/** stats-api's list as /v2/chains answers it: the C-Chain by its blockchain ID, Gunzilla by its EVM id, an L1 the catalog does not list, and a testnet */
const LIST = {
  chains: [
    { evmChainId: 43419, chainName: 'gunz', blockchainId: '2M47TxWHGnhNtq6pM5zPXdATBtuqubxn5EPFgFmEawCQr9WFML', network: 'mainnet' },
    { evmChainId: 43114, chainName: 'c_chain', blockchainId: '2q9e4r6Mu3U68nU1fYjgbR6JvwrRx36CohpAX5UQxse55x1Q5', network: 'mainnet' },
    { evmChainId: 999001, chainName: 'unlisted', network: 'mainnet' },
    { evmChainId: 43113, chainName: 'fuji', network: 'testnet' },
  ],
};

let answer: () => Response;
beforeEach(() => {
  answer = () => new Response(JSON.stringify(LIST), { status: 200 });
  vi.stubGlobal('fetch', vi.fn(async () => answer()));
});
afterEach(() => vi.unstubAllGlobals());

async function fresh() {
  vi.resetModules();
  return import('@/lib/explorer-query/sources');
}

describe('the network target', () => {
  it('reads the EVM tables and chain_names, under an id and a slug no chain has', () => {
    const t = targetOf(NETWORK_ID);
    expect(t.kind).toBe('evm');
    expect(t.tables).toEqual(['raw_blocks', 'raw_txs', 'raw_logs', 'raw_traces']);
    expect(t.refs).toEqual(['chain_names']);
    expect([NETWORK_ID, NETWORK_SLUG]).toEqual([0, 'all']);
  });

  it("lists stats-api's mainnet chains, the C-Chain first, named as the catalog names them", async () => {
    const chains = await (await fresh()).networkChains();
    expect(chains.map((c) => c.chainId)).toEqual([43114, 43419, 999001]);
    expect(chains[0]).toMatchObject({ name: 'C-Chain', symbol: 'AVAX', slug: 'c-chain' });
    expect(chains[0].blockchainId).toMatch(/^0x[0-9a-f]{64}$/);
    expect(chains[2]).toEqual({ chainId: 999001, name: 'unlisted', symbol: null, slug: null, blockchainId: null });
  });

  it("stands the catalog's mainnet EVM chains in when the list does not answer, and never a testnet", async () => {
    answer = () => new Response('down', { status: 503 });
    const chains = await (await fresh()).networkChains();
    expect(chains[0].chainId).toBe(43114);
    expect(chains.map((c) => c.chainId)).toContain(4337);
    expect(chains.map((c) => c.chainId)).not.toContain(43113);
    // KiteAI's catalog id is its blockchain ID; its EVM id is 2366
    expect(chains.map((c) => c.chainId)).toContain(2366);
  });

  it("defines each table a query names as the network's chains alone, and chain_names in front of it", async () => {
    const sql = `SELECT n.chain AS chain, count() AS txs FROM raw_txs AS t INNER JOIN chain_names AS n ON n.chain_id = t.chain_id WHERE t.${W} GROUP BY chain`;
    const out = await (await fresh()).withSources(sql, NETWORK_ID);
    expect(out.sql.startsWith('WITH raw_txs AS (SELECT * FROM raw_txs WHERE chain_id IN (43114, 43419, 999001)), chain_names AS (SELECT toUInt64(tupleElement(r, 1)) AS chain_id, base64Decode(tupleElement(r, 2)) AS chain,')).toBe(true);
    expect(out.sql).not.toContain('43113');
    expect(out.sources).toEqual([expect.objectContaining({ table: 'chain_names', total: 3, known: 2 })]);
    // a name with a word the query service refuses in a string travels as base64
    expect(out.sql).toContain(`'${Buffer.from('C-Chain').toString('base64')}'`);
  });
});

describe("the guard on the network", () => {
  it('needs no chain filter, takes a list of chains, and still bounds every wide table', () => {
    expect(guardSql(`SELECT count() AS n FROM raw_txs WHERE ${W}`, NETWORK_ID).ok).toBe(true);
    expect(guardSql(`SELECT count() AS n FROM raw_txs WHERE chain_id IN (43114, 43419) AND ${W}`, NETWORK_ID).ok).toBe(true);
    const g = guardSql('SELECT count() AS n FROM raw_txs', NETWORK_ID);
    expect(g.ok ? '' : g.error).toMatch(/^bound raw_txs on block_time or block_number/);
  });

  it('reads chain_names, which no chain page may', () => {
    const sql = `SELECT n.chain AS chain, count() AS txs FROM raw_txs AS t INNER JOIN chain_names AS n ON n.chain_id = t.chain_id WHERE t.${W} GROUP BY chain`;
    expect(guardSql(sql, NETWORK_ID).ok).toBe(true);
    const c = guardSql(sql.replace(`WHERE t.${W}`, `WHERE t.chain_id = 43114 AND t.${W}`), 43114);
    expect(c.ok ? '' : c.error).toMatch(/^table chain_names is not readable here/);
  });

  it("refuses the C-Chain's shorthand, whose registries are the C-Chain's", () => {
    const g = guardSql('$DEX(now() - INTERVAL 1 DAY) SELECT count() AS swaps FROM legs', NETWORK_ID);
    expect(g.ok).toBe(false);
  });
});

describe("a network answer's rows", () => {
  const rows = (names: string[], data: Record<string, unknown>[] = [{}]) => ({ columns: names.map((name) => ({ name })), rows: data });

  it('keep each chain\'s native amounts apart', () => {
    expect(mixedChains(rows(['fees_native', 'txs']))).toMatch(/^fees_native adds up amounts of different native tokens/);
    expect(mixedChains(rows(['chain', 'chain_id', 'token', 'fees_native']))).toBeNull();
    expect(mixedChains(rows(['chain_id', 'fees_avax'], [{ chain_id: 43114 }, { chain_id: 43419 }]))).toMatch(/^fees_avax is named for AVAX/);
    expect(mixedChains(rows(['chain_id', 'fees_avax'], [{ chain_id: 43114 }]))).toBeNull();
    // counts, gas, shares and USD add up across chains
    expect(mixedChains(rows(['t', 'txs', 'gas_charged', 'revert_pct', 'active_addresses']))).toBeNull();
  });

  it("give the reading no total, extreme or share of amounts in different tokens", () => {
    const columns = [{ name: 'chain', type: 'String' }, { name: 'chain_id', type: 'UInt64' }, { name: 'token', type: 'String' }, { name: 'fee_native', type: 'Float64' }, { name: 'txs', type: 'UInt64' }];
    const at = (rows: Record<string, unknown>[]) => figures({ columns, rows, names: {}, x: 'chain' });
    const lines = at([{ chain: 'Gunzilla', chain_id: '43419', token: 'GUN', fee_native: 9.21, txs: 230000 }, { chain: 'C-Chain', chain_id: '43114', token: 'AVAX', fee_native: 3.73, txs: 243000 }]);
    expect(lines.find((l) => l.startsWith('fee_native'))).toMatch(/its own chain's native token.*no total, highest, lowest or share/);
    // counts add up across chains
    expect(lines.find((l) => l.startsWith('txs'))).toMatch(/total 473000/);
    // one chain's rows keep their figures
    const one = at([{ chain: 'C-Chain', chain_id: '43114', token: 'AVAX', fee_native: 1, txs: 1 }, { chain: 'C-Chain', chain_id: '43114', token: 'AVAX', fee_native: 3, txs: 2 }]);
    expect(one.find((l) => l.startsWith('fee_native'))).toMatch(/total 4/);
  });

  it('put each record on its chain', () => {
    expect(mixedChains(rows(['address', 'txs']))).toMatch(/^the rows name records \(address\) with no chain_id/);
    expect(mixedChains(rows(['chain_id', 'tx_hash', 'fee_native']))).toBeNull();
  });
});

describe("a network row's links", () => {
  it("open on the chain the row's chain_id names, and nowhere for a row that names none", () => {
    expect(rowBase('/explorer/mainnet/all', { chain_id: '43114' })).toBe('/explorer/mainnet/c-chain');
    expect(rowBase('/explorer/mainnet/all', { chain_id: 4337 })).toBe('/explorer/mainnet/beam');
    // KiteAI's catalog id is its blockchain ID; its rows carry 2366
    expect(rowBase('/explorer/mainnet/all', { chain_id: 2366 })).toBe('/explorer/mainnet/kite');
    expect(rowBase('/explorer/mainnet/all', { chain_id: 999001 })).toBeNull();
    expect(rowBase('/explorer/mainnet/all', { tx_hash: '0x1' })).toBeNull();
    expect(rowBase('/explorer/mainnet/all')).toBeNull();
  });

  it("keep a chain page's own base, whatever the row holds", () => {
    expect(rowBase('/explorer/mainnet/beam', { chain_id: 43114 })).toBe('/explorer/mainnet/beam');
    expect(rowBase('/explorer/mainnet/c-chain')).toBe('/explorer/mainnet/c-chain');
  });
});

describe("the network's writer", () => {
  it("is told its chains by id, and keys its recipes apart from the C-Chain's", () => {
    const text = networkPrompt({ schema: 'raw_txs(chain_id UInt64)', coverage: null, chains: [{ chainId: 43114, name: 'C-Chain', symbol: 'AVAX', slug: 'c-chain', blockchainId: null }, { chainId: 2366, name: 'Kite AI', symbol: null, slug: 'kite', blockchainId: null }] });
    expect(text).toContain('The chains, by chain_id: 43114: C-Chain (AVAX); 2366: Kite AI.');
    expect(text).not.toContain('—');
    expect(networkVersion()).toMatch(/^[0-9a-f]{12}$/);
    expect(networkVersion()).not.toBe(promptVersion(43114));
    expect(recipeKey(NETWORK_ID, 'Transactions per chain this week')).not.toBe(recipeKey(43114, 'Transactions per chain this week'));
  });
});
