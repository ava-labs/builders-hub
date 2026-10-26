import { afterEach, describe, expect, it, vi } from 'vitest';
import { balanceService } from './balanceService';

const ADDRESS = '0x8EB8a3b98659Cce290402893d0123abb75E3ab28';

interface RpcCall {
  url: string;
  method: string;
}

// Answers every JSON-RPC request with `result` and records which URL and
// method each call used.
function stubRpc(result: string): RpcCall[] {
  const calls: RpcCall[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body));
      calls.push({ url: String(input), method: body.method });
      return new Response(JSON.stringify({ jsonrpc: '2.0', id: body.id, result }), {
        headers: { 'content-type': 'application/json' },
      });
    }),
  );
  return calls;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('balanceService', () => {
  it('reads the mainnet C-Chain balance with eth_getBalance', async () => {
    const calls = stubRpc('0x753d533d968000');
    await expect(balanceService.fetchCChainBalance(false, ADDRESS)).resolves.toBe(0.033);
    expect(calls).toEqual([{ url: 'https://api.avax.network/ext/bc/C/rpc', method: 'eth_getBalance' }]);
  });

  it('reads the Fuji C-Chain balance with eth_getBalance', async () => {
    const calls = stubRpc('0xde0b6b3a7640000');
    await expect(balanceService.fetchCChainBalance(true, ADDRESS)).resolves.toBe(1);
    expect(calls).toEqual([{ url: 'https://api.avax-test.network/ext/bc/C/rpc', method: 'eth_getBalance' }]);
  });

  it('reads a C-Chain L1 balance without a registered RPC URL', async () => {
    const calls = stubRpc('0xde0b6b3a7640000');
    await expect(balanceService.fetchL1Balance(43113, ADDRESS, null)).resolves.toBe(1);
    expect(calls).toEqual([{ url: 'https://api.avax-test.network/ext/bc/C/rpc', method: 'eth_getBalance' }]);
  });

  it('reads the P-Chain balance from the node only', async () => {
    const calls: RpcCall[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const body = JSON.parse(String(init?.body));
        calls.push({ url: String(input), method: body.method });
        return new Response(JSON.stringify({ jsonrpc: '2.0', id: 1, result: { unlocked: '25059479277' } }));
      }),
    );
    await expect(balanceService.fetchPChainBalance(false, 'avax1rfza95r2p8gq2c3r5evu2fecqey5je0fucrg2h')).resolves.toBe(
      25.059479277,
    );
    expect(calls).toEqual([{ url: 'https://api.avax.network/ext/bc/P', method: 'platform.getBalance' }]);
  });

  it('returns 0 for the P-Chain balance when the node fails', async () => {
    const fetchMock = vi.fn(async () => new Response('bad gateway', { status: 502 }));
    vi.stubGlobal('fetch', fetchMock);
    vi.spyOn(console, 'error').mockImplementation(() => {});
    await expect(balanceService.fetchPChainBalance(true, 'fuji19j5wc4tue3k9fuy2d5r7f854ldg4h9nu5l9gny')).resolves.toBe(
      0,
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
