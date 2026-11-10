import { afterEach, describe, expect, it, vi } from 'vitest';
import { getPChainUnlockedNAvax } from '@/components/toolbox/utils/pChainNodeBalance';
import { TEST_ADDRESS, txId, utxoHex } from '../utils/pchain-utxo-fixture';

const FUJI_AVAX = 'U8iRqJoiJm8xZHAacmvYyZVwqQx6uDNtQeP3CQ6fcgQk3JqnK';
const MAINNET_AVAX = 'FvwEAhmxKfeiG8SnEvq42hc6whRyY3EFYAvebMqDNDGCgxN5Z';
/** 2100-01-01 in seconds: locked by the local clock, unlocked if the clock were read in milliseconds. */
const YEAR_2100 = 4_102_444_800n;
const LAST_PAGE_END = { address: TEST_ADDRESS, utxo: '11111111111111111111111111111111LpoYY' };

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

/**
 * A P-Chain node, as the public API answers: platform.getStakingAssetID gives `avax`, platform.getUTXOs gives `utxos`
 * in one page, and any other method does not exist.
 */
function mockNode(avax: string, utxos: string[]) {
  return vi.spyOn(globalThis, 'fetch').mockImplementation(async (_url, init) => {
    const { method, id } = JSON.parse(String(init?.body));
    const result =
      method === 'platform.getStakingAssetID'
        ? { assetID: avax }
        : method === 'platform.getUTXOs'
          ? { numFetched: String(utxos.length), utxos, endIndex: LAST_PAGE_END, encoding: 'hex' }
          : undefined;
    const body = result
      ? { jsonrpc: '2.0', result, id }
      : { jsonrpc: '2.0', id, error: { code: -32601, message: `the method ${method} does not exist` } };
    return new Response(JSON.stringify(body), { headers: { 'content-type': 'application/json' } });
  });
}

function utxo(n: number, assetId: string, amount: bigint, stakeableLocktime?: bigint): string {
  return utxoHex({ txID: txId(n), index: 0, assetId, amount, address: TEST_ADDRESS, stakeableLocktime });
}

const requestsOf = (fetchMock: ReturnType<typeof mockNode>) =>
  fetchMock.mock.calls.map(([url, init]) => ({ url: String(url), ...JSON.parse(String(init?.body)) }));

describe('getPChainUnlockedNAvax', () => {
  it('returns the unlocked nAVAX and leaves out a stakeable lock', async () => {
    mockNode(FUJI_AVAX, [utxo(1, FUJI_AVAX, 1_500_000_000n), utxo(2, FUJI_AVAX, 2_000_000_000n, YEAR_2100)]);

    await expect(getPChainUnlockedNAvax(true, TEST_ADDRESS)).resolves.toBe(1_500_000_000n);
  });

  it('reads platform.getUTXOs on the Fuji node for testnet, never platform.getBalance', async () => {
    const fetchMock = mockNode(FUJI_AVAX, []);

    await getPChainUnlockedNAvax(true, TEST_ADDRESS);

    const requests = requestsOf(fetchMock);
    expect(requests.every((r) => r.url === 'https://api.avax-test.network/ext/bc/P')).toBe(true);
    expect(requests.find((r) => r.method === 'platform.getUTXOs')?.params.addresses).toEqual([TEST_ADDRESS]);
    expect(requests.map((r) => r.method)).not.toContain('platform.getBalance');
  });

  it('reads the Mainnet node and Mainnet AVAX otherwise', async () => {
    const fetchMock = mockNode(MAINNET_AVAX, [utxo(1, MAINNET_AVAX, 3n), utxo(2, FUJI_AVAX, 5n)]);

    await expect(getPChainUnlockedNAvax(false, TEST_ADDRESS)).resolves.toBe(3n);
    expect(requestsOf(fetchMock).every((r) => r.url === 'https://api.avax.network/ext/bc/P')).toBe(true);
  });

  it('adds P- to a bare address', async () => {
    const fetchMock = mockNode(FUJI_AVAX, []);

    await getPChainUnlockedNAvax(true, TEST_ADDRESS.slice('P-'.length));

    const getUtxos = requestsOf(fetchMock).find((r) => r.method === 'platform.getUTXOs');
    expect(getUtxos?.params.addresses).toEqual([TEST_ADDRESS]);
  });

  it('throws on an HTTP error so the caller can fall back', async () => {
    vi.useFakeTimers();
    vi.spyOn(globalThis, 'fetch').mockImplementation(
      async () => new Response('Bad Gateway', { status: 502, statusText: 'Bad Gateway' }),
    );

    const read = expect(getPChainUnlockedNAvax(true, TEST_ADDRESS)).rejects.toHaveProperty('status', 502);
    // viem retries a 502 3 times: run every retry here, or the last one calls the next test's fetch
    await vi.runAllTimersAsync();
    await read;
  });

  it('throws on an RPC error so the caller can fall back', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (_url, init) => {
      const { id } = JSON.parse(String(init?.body));
      const error = { code: -32000, message: "couldn't parse address", data: null };
      return new Response(JSON.stringify({ jsonrpc: '2.0', error, id }), {
        headers: { 'content-type': 'application/json' },
      });
    });

    await expect(getPChainUnlockedNAvax(true, TEST_ADDRESS)).rejects.toThrow();
  });

  it('stops the rest of the read when one of its requests fails', async () => {
    // platform.getStakingAssetID fails at once; platform.getUTXOs waits, and like fetch it rejects when aborted
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async (_url, init) => {
      const { method, id } = JSON.parse(String(init?.body));
      if (method === 'platform.getUTXOs') {
        return new Promise<Response>((_, reject) => {
          init?.signal?.addEventListener('abort', () => reject(init.signal?.reason), { once: true });
        });
      }
      const error = { code: -32000, message: 'internal error', data: null };
      return new Response(JSON.stringify({ jsonrpc: '2.0', error, id }), {
        headers: { 'content-type': 'application/json' },
      });
    });

    await expect(getPChainUnlockedNAvax(true, TEST_ADDRESS)).rejects.toThrow();

    const getUtxos = requestsOf(fetchMock).findIndex((r) => r.method === 'platform.getUTXOs');
    expect(getUtxos).toBeGreaterThan(-1);
    expect(fetchMock.mock.calls[getUtxos][1]?.signal?.aborted).toBe(true);
  });

  it('gives every request of the read one abort signal, and the 10 s budget aborts it', async () => {
    vi.useFakeTimers();
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(() => new Promise<Response>(() => undefined));

    getPChainUnlockedNAvax(true, TEST_ADDRESS).catch(() => undefined);
    await vi.advanceTimersByTimeAsync(0);
    const signals = fetchMock.mock.calls.map(([, init]) => init?.signal);
    expect(signals.length).toBeGreaterThan(1);
    expect(signals[0]).toBeInstanceOf(AbortSignal);
    expect(new Set(signals).size).toBe(1);
    expect(signals[0]?.aborted).toBe(false);
    await vi.advanceTimersByTimeAsync(10_000);

    expect(signals[0]?.aborted).toBe(true);
  });

  it('gives up after 10 s when the node does not answer, so the caller can fall back', async () => {
    vi.useFakeTimers();
    vi.spyOn(globalThis, 'fetch').mockImplementation(() => new Promise<Response>(() => undefined));

    let outcome: unknown = 'pending';
    getPChainUnlockedNAvax(true, TEST_ADDRESS).then(
      (value) => (outcome = value),
      (error: Error) => (outcome = error),
    );
    await vi.advanceTimersByTimeAsync(9_999);
    expect(outcome).toBe('pending');
    await vi.advanceTimersByTimeAsync(1);

    expect(outcome).toBeInstanceOf(Error);
  });

  it('makes no more requests once the 10 s budget runs out', async () => {
    vi.useFakeTimers();
    // No answer; like fetch, a rejection when the signal aborts, and at once when it is already aborted
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(
      (_url, init) =>
        new Promise<Response>((_, reject) => {
          const signal = init?.signal;
          if (signal?.aborted) {
            reject(signal.reason);
            return;
          }
          signal?.addEventListener('abort', () => reject(signal.reason), { once: true });
        }),
    );

    getPChainUnlockedNAvax(true, TEST_ADDRESS).catch(() => undefined);
    await vi.advanceTimersByTimeAsync(10_000);
    const requests = fetchMock.mock.calls.length;
    await vi.runAllTimersAsync();

    expect(fetchMock.mock.calls.length).toBe(requests);
  });

  it('stops a read after 21 requests: platform.getStakingAssetID and 20 pages', async () => {
    // Endless full pages, as for an address that someone sent tens of thousands of UTXOs. Like fetch, nothing goes out
    // on an aborted signal. After 100 requests the node fails the read, so the test ends without the cap too.
    const page = Array.from({ length: 1024 }, (_, i) => utxo(i + 1, FUJI_AVAX, 1n));
    let sent = 0;
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (_url, init) => {
      if (init?.signal?.aborted) throw init.signal.reason;
      sent++;
      const { method, id } = JSON.parse(String(init?.body));
      const result =
        method === 'platform.getStakingAssetID'
          ? { assetID: FUJI_AVAX }
          : { numFetched: '1024', utxos: page, endIndex: LAST_PAGE_END, encoding: 'hex' };
      const body =
        sent > 100
          ? { jsonrpc: '2.0', id, error: { code: -32000, message: 'too many requests', data: null } }
          : { jsonrpc: '2.0', result, id };
      return new Response(JSON.stringify(body), { headers: { 'content-type': 'application/json' } });
    });

    await expect(getPChainUnlockedNAvax(true, TEST_ADDRESS)).rejects.toThrow();

    expect(sent).toBe(21);
  });
});
