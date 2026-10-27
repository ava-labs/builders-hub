import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { utils } from '@avalanche-sdk/client/utils';
import { clearCache } from '@/lib/mcp/cache';
import { dataTools } from '@/lib/mcp/tools/data';
import { platformTools } from '@/lib/mcp/tools/platform';
import { TEST_ADDRESS, txId, utxoHex } from '../utils/pchain-utxo-fixture';

const FUJI_AVAX = 'U8iRqJoiJm8xZHAacmvYyZVwqQx6uDNtQeP3CQ6fcgQk3JqnK';
const MAINNET_AVAX = 'FvwEAhmxKfeiG8SnEvq42hc6whRyY3EFYAvebMqDNDGCgxN5Z';
const MAINNET_ADDRESS = utils.format('P', 'avax', new Uint8Array(20).fill(1));
const OTHER_ASSET = txId(424_242); // any ID that is not AVAX
/** 2100-01-01 in seconds. */
const YEAR_2100 = 4_102_444_800n;

/** 1.5 AVAX unlocked, 2 AVAX stakeable-locked, and 7 units of another asset. */
const UTXOS = [
  utxoHex({ txID: txId(1), index: 0, assetId: FUJI_AVAX, amount: 1_500_000_000n, address: TEST_ADDRESS }),
  utxoHex({
    txID: txId(2),
    index: 0,
    assetId: FUJI_AVAX,
    amount: 2_000_000_000n,
    address: TEST_ADDRESS,
    stakeableLocktime: YEAR_2100,
  }),
  utxoHex({ txID: txId(3), index: 1, assetId: OTHER_ASSET, amount: 7n, address: TEST_ADDRESS }),
];

/** On Mainnet: 1 AVAX unlocked, and 5 units of Fuji's AVAX, which Mainnet counts as another asset. */
const MAINNET_UTXOS = [
  utxoHex({ txID: txId(4), index: 0, assetId: MAINNET_AVAX, amount: 1_000_000_000n, address: MAINNET_ADDRESS }),
  utxoHex({ txID: txId(5), index: 0, assetId: FUJI_AVAX, amount: 5n, address: MAINNET_ADDRESS }),
];

/** 1024 UTXOs: a node that answers every page with these never runs out. */
const FULL_PAGE = Array.from({ length: 1024 }, (_, i) =>
  utxoHex({ txID: txId(i + 1), index: 0, assetId: FUJI_AVAX, amount: 1n, address: TEST_ADDRESS }),
);

/** A node that answers platform.getUTXOs with `utxos` (one page) and any other method with an RPC error. */
function mockNode(utxos = UTXOS) {
  return vi.spyOn(globalThis, 'fetch').mockImplementation(async (_url, init) => {
    const { method } = JSON.parse(String(init?.body));
    const body =
      method === 'platform.getUTXOs'
        ? {
            jsonrpc: '2.0',
            result: {
              numFetched: String(utxos.length),
              utxos,
              endIndex: { address: TEST_ADDRESS, utxo: txId(3) },
              encoding: 'hex',
            },
            id: 1,
          }
        : {
            jsonrpc: '2.0',
            error: { code: -32601, message: `the method ${method} does not exist`, data: null },
            id: 1,
          };
    return new Response(JSON.stringify(body), { headers: { 'content-type': 'application/json' } });
  });
}

const methodsOf = (fetchMock: ReturnType<typeof mockNode>) =>
  fetchMock.mock.calls.map(([, init]) => JSON.parse(String(init?.body)).method);

const textOf = (result: { content: { text: string }[] }) => result.content[0]?.text ?? '';

beforeEach(() => clearCache());
afterEach(() => vi.restoreAllMocks());

describe('platform_get_balance', () => {
  it("returns platform.getBalance's JSON plus balance_avax, read from platform.getUTXOs", async () => {
    const fetchMock = mockNode();

    const result = await platformTools.handlers.platform_get_balance({ addresses: [TEST_ADDRESS], network: 'fuji' });

    expect(result.isError).toBeFalsy();
    expect(JSON.parse(textOf(result))).toEqual({
      balance: '3500000000',
      unlocked: '1500000000',
      lockedStakeable: '2000000000',
      lockedNotStakeable: '0',
      balances: { [FUJI_AVAX]: '3500000000', [OTHER_ASSET]: '7' },
      unlockeds: { [FUJI_AVAX]: '1500000000', [OTHER_ASSET]: '7' },
      lockedStakeables: { [FUJI_AVAX]: '2000000000' },
      lockedNotStakeables: {},
      utxoIDs: expect.arrayContaining([
        { txID: txId(1), outputIndex: 0 },
        { txID: txId(2), outputIndex: 0 },
        { txID: txId(3), outputIndex: 1 },
      ]),
      balance_avax: '3.5',
    });
    expect(fetchMock.mock.calls[0][0]).toBe('https://api.avax-test.network/ext/bc/P');
    expect(methodsOf(fetchMock)).toEqual(['platform.getUTXOs']);
  });

  it('reads Mainnet AVAX from the Mainnet node by default', async () => {
    const fetchMock = mockNode(MAINNET_UTXOS);

    const result = await platformTools.handlers.platform_get_balance({ addresses: [MAINNET_ADDRESS] });

    expect(JSON.parse(textOf(result))).toMatchObject({
      balance: '1000000000',
      unlocked: '1000000000',
      balance_avax: '1',
    });
    expect(fetchMock.mock.calls[0][0]).toBe('https://api.avax.network/ext/bc/P');
  });

  it('reads at most 5 pages for one call', async () => {
    const fetchMock = mockNode(FULL_PAGE);

    const result = await platformTools.handlers.platform_get_balance({ addresses: [TEST_ADDRESS], network: 'fuji' });

    expect(result.isError).toBe(true);
    expect(textOf(result)).toBe('platform.getUTXOs: more than 5 pages (5,120 UTXOs)');
    expect(fetchMock).toHaveBeenCalledTimes(5);
  });

  it.each([
    ['missing', {}],
    ['empty', { addresses: [] }],
    ['not strings', { addresses: [123] }],
    ['blank', { addresses: [''] }],
  ])('rejects %s addresses without a request', async (_case, args) => {
    const fetchMock = mockNode();

    const result = await platformTools.handlers.platform_get_balance(args);

    expect(result.isError).toBe(true);
    expect(textOf(result)).toBe('Error: addresses must be a non-empty array of P-Chain addresses');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('serves a repeat call from the cache', async () => {
    const fetchMock = mockNode();

    const first = await platformTools.handlers.platform_get_balance({ addresses: [TEST_ADDRESS], network: 'fuji' });
    const second = await platformTools.handlers.platform_get_balance({ addresses: [TEST_ADDRESS], network: 'fuji' });

    expect(first.isError).toBeFalsy();
    expect(textOf(second)).toBe(textOf(first));
    expect(methodsOf(fetchMock)).toEqual(['platform.getUTXOs']);
  });
});

describe('onchain_lookup, P-Chain address', () => {
  it('reads the balance from platform.getUTXOs', async () => {
    const fetchMock = mockNode();

    const result = await dataTools.handlers.onchain_lookup({ value: TEST_ADDRESS });

    expect(result.isError).toBeFalsy();
    expect(JSON.parse(textOf(result))).toMatchObject({
      kind: 'pchain-address',
      address: TEST_ADDRESS,
      network: 'fuji',
      balanceAvax: '3.5',
      unlockedAvax: '1.5',
      lockedStakeableAvax: '2',
      utxoCount: 3,
    });
    expect(fetchMock.mock.calls[0][0]).toBe('https://api.avax-test.network/ext/bc/P');
    expect(methodsOf(fetchMock)).toEqual(['platform.getUTXOs']);
  });

  it('reads a Mainnet address from the Mainnet node, in Mainnet AVAX', async () => {
    const fetchMock = mockNode(MAINNET_UTXOS);

    const result = await dataTools.handlers.onchain_lookup({ value: MAINNET_ADDRESS });

    expect(JSON.parse(textOf(result))).toMatchObject({ network: 'mainnet', balanceAvax: '1', utxoCount: 2 });
    expect(fetchMock.mock.calls[0][0]).toBe('https://api.avax.network/ext/bc/P');
  });

  it('reads at most 5 pages', async () => {
    const fetchMock = mockNode(FULL_PAGE);

    const result = await dataTools.handlers.onchain_lookup({ value: TEST_ADDRESS });

    expect(result.isError).toBe(true);
    expect(textOf(result)).toBe('platform.getUTXOs: more than 5 pages (5,120 UTXOs)');
    expect(fetchMock).toHaveBeenCalledTimes(5);
  });
});
