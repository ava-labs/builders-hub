import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TEST_ADDRESS, txId, utxoHex } from '../utils/pchain-utxo-fixture';

// No L1 has a faucet here, so the route reads only the P-Chain.
vi.mock('@/components/toolbox/stores/l1ListStore', () => ({
  getL1ListStore: () => ({ getState: () => ({ l1List: [] }) }),
}));

const FUJI_AVAX = 'U8iRqJoiJm8xZHAacmvYyZVwqQx6uDNtQeP3CQ6fcgQk3JqnK';
/** 2100-01-01 in seconds. */
const YEAR_2100 = 4_102_444_800n;

/** The route reads its env when it loads, so each case loads it again. */
async function loadRoute() {
  vi.resetModules();
  vi.stubEnv('FAUCET_P_CHAIN_ADDRESS', TEST_ADDRESS);
  vi.stubEnv('FAUCET_C_CHAIN_ADDRESS', '');
  return import('@/app/api/faucet-balance/route');
}

/** The Fuji P-Chain: AVAX is the staking asset, and the faucet holds 1.5 AVAX unlocked and 2 AVAX in a stakeable lock. */
function fujiNode() {
  const utxos = [
    utxoHex({ txID: txId(1), index: 0, assetId: FUJI_AVAX, amount: 1_500_000_000n, address: TEST_ADDRESS }),
    utxoHex({
      txID: txId(2),
      index: 0,
      assetId: FUJI_AVAX,
      amount: 2_000_000_000n,
      address: TEST_ADDRESS,
      stakeableLocktime: YEAR_2100,
    }),
  ];
  return vi.spyOn(globalThis, 'fetch').mockImplementation(async (_url, init) => {
    const { method, id } = JSON.parse(String(init?.body));
    const result =
      method === 'platform.getStakingAssetID'
        ? { assetID: FUJI_AVAX }
        : method === 'platform.getUTXOs'
          ? { numFetched: '2', utxos, endIndex: { address: TEST_ADDRESS, utxo: txId(2) }, encoding: 'hex' }
          : undefined;
    const body = result
      ? { jsonrpc: '2.0', result, id }
      : { jsonrpc: '2.0', id, error: { code: -32601, message: `the method ${method} does not exist` } };
    return new Response(JSON.stringify(body), { headers: { 'content-type': 'application/json' } });
  });
}

beforeEach(() => {
  vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

describe('GET /api/faucet-balance, P-Chain', () => {
  it("shows the faucet's AVAX on the Fuji P-Chain, locked included", async () => {
    fujiNode();
    const { GET } = await loadRoute();

    const body = await (await GET({} as never)).json();

    expect(body).toEqual({
      success: true,
      pChain: { balance: '3500000000', balanceFormatted: '3.50', faucetAddress: TEST_ADDRESS },
      evmChains: [],
    });
  });

  it('reads platform.getUTXOs on the Fuji node, never platform.getBalance', async () => {
    const fetchMock = fujiNode();
    const { GET } = await loadRoute();

    await GET({} as never);

    const requests = fetchMock.mock.calls.map(([url, init]) => ({
      url: String(url),
      method: JSON.parse(String(init?.body)).method,
    }));
    expect(requests.every((r) => r.url === 'https://api.avax-test.network/ext/bc/P')).toBe(true);
    expect(requests.map((r) => r.method)).toContain('platform.getUTXOs');
    expect(requests.map((r) => r.method)).not.toContain('platform.getBalance');
  });

  it('shows no P-Chain balance when the node does not answer within 10 s', async () => {
    vi.useFakeTimers();
    vi.spyOn(globalThis, 'fetch').mockImplementation(() => new Promise<Response>(() => undefined));
    const { GET } = await loadRoute();

    let body: unknown = 'pending';
    GET({} as never).then(async (response) => (body = await response.json()));
    await vi.advanceTimersByTimeAsync(10_000);

    expect(body).toEqual({ success: true, evmChains: [] });
  });

  it('shows no P-Chain balance when the read fails', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async () => new Response('Bad Request', { status: 400 }));
    const { GET } = await loadRoute();

    const body = await (await GET({} as never)).json();

    expect(body).toEqual({ success: true, evmChains: [] });
  });
});
