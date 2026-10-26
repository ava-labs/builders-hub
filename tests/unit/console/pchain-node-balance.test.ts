import { afterEach, describe, expect, it, vi } from 'vitest';
import { getPChainUnlockedNAvax } from '@/components/toolbox/utils/pChainNodeBalance';
import { TEST_ADDRESS, txId, utxoHex } from '../utils/pchain-utxo-fixture';

const FUJI_AVAX = 'U8iRqJoiJm8xZHAacmvYyZVwqQx6uDNtQeP3CQ6fcgQk3JqnK';
const MAINNET_AVAX = 'FvwEAhmxKfeiG8SnEvq42hc6whRyY3EFYAvebMqDNDGCgxN5Z';
/** 2100-01-01 in seconds: locked by the local clock, unlocked if the clock were read in milliseconds. */
const YEAR_2100 = 4_102_444_800n;
const LAST_PAGE_END = { address: TEST_ADDRESS, utxo: '11111111111111111111111111111111LpoYY' };

afterEach(() => vi.restoreAllMocks());

/** A platform.getUTXOs response, as the node sends it. */
function utxosResponse(utxos: string[], endIndex = LAST_PAGE_END): Response {
  const result = { numFetched: String(utxos.length), utxos, endIndex, encoding: 'hex' };
  return new Response(JSON.stringify({ jsonrpc: '2.0', result, id: 1 }), {
    headers: { 'content-type': 'application/json' },
  });
}

function mockNode(...responses: Response[]) {
  const fetchMock = vi.spyOn(globalThis, 'fetch');
  for (const response of responses) fetchMock.mockResolvedValueOnce(response);
  return fetchMock;
}

function utxo(n: number, assetId: string, amount: bigint, stakeableLocktime?: bigint): string {
  return utxoHex({ txID: txId(n), index: 0, assetId, amount, address: TEST_ADDRESS, stakeableLocktime });
}

const requestOf = (fetchMock: ReturnType<typeof mockNode>, call: number) => {
  const [url, init] = fetchMock.mock.calls[call];
  return { url, init, body: JSON.parse(String(init?.body)) };
};

describe('getPChainUnlockedNAvax', () => {
  it('returns the unlocked nAVAX and leaves out a stakeable lock', async () => {
    mockNode(utxosResponse([utxo(1, FUJI_AVAX, 1_500_000_000n), utxo(2, FUJI_AVAX, 2_000_000_000n, YEAR_2100)]));

    await expect(getPChainUnlockedNAvax(true, TEST_ADDRESS)).resolves.toBe(1_500_000_000n);
  });

  it('POSTs platform.getUTXOs to the Fuji node for testnet', async () => {
    const fetchMock = mockNode(utxosResponse([]));

    await getPChainUnlockedNAvax(true, TEST_ADDRESS);

    const { url, init, body } = requestOf(fetchMock, 0);
    expect(url).toBe('https://api.avax-test.network/ext/bc/P');
    expect(init?.method).toBe('POST');
    expect(body.method).toBe('platform.getUTXOs');
    expect(body.params).toEqual({ addresses: [TEST_ADDRESS], limit: 1024, encoding: 'hex' });
  });

  it('reads the Mainnet node and Mainnet AVAX otherwise', async () => {
    const fetchMock = mockNode(utxosResponse([utxo(1, MAINNET_AVAX, 3n), utxo(2, FUJI_AVAX, 5n)]));

    await expect(getPChainUnlockedNAvax(false, TEST_ADDRESS)).resolves.toBe(3n);
    expect(requestOf(fetchMock, 0).url).toBe('https://api.avax.network/ext/bc/P');
  });

  it('adds P- to a bare address', async () => {
    const fetchMock = mockNode(utxosResponse([]));

    await getPChainUnlockedNAvax(true, TEST_ADDRESS.slice('P-'.length));

    expect(requestOf(fetchMock, 0).body.params.addresses).toEqual([TEST_ADDRESS]);
  });

  it('throws on an HTTP error so the caller can fall back', async () => {
    mockNode(new Response('Bad Gateway', { status: 502, statusText: 'Bad Gateway' }));

    await expect(getPChainUnlockedNAvax(true, TEST_ADDRESS)).rejects.toThrow('502 Bad Gateway');
  });

  it('throws on an RPC error so the caller can fall back', async () => {
    const error = { code: -32000, message: "couldn't parse address", data: null };
    mockNode(new Response(JSON.stringify({ jsonrpc: '2.0', error, id: 1 }), { status: 200 }));

    await expect(getPChainUnlockedNAvax(true, TEST_ADDRESS)).rejects.toThrow("couldn't parse address");
  });

  it('gives every page the same abort signal, so one timeout covers the whole read', async () => {
    const fullPage = Array.from({ length: 1024 }, (_, i) => utxo(i + 1, FUJI_AVAX, 1n));
    const fetchMock = mockNode(
      utxosResponse(fullPage, { address: TEST_ADDRESS, utxo: txId(1024) }),
      utxosResponse([utxo(2000, FUJI_AVAX, 1n)]),
    );

    await expect(getPChainUnlockedNAvax(true, TEST_ADDRESS)).resolves.toBe(1025n);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    const first = requestOf(fetchMock, 0).init?.signal;
    expect(first).toBeInstanceOf(AbortSignal);
    expect(requestOf(fetchMock, 1).init?.signal).toBe(first);
  });
});
