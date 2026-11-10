import { afterEach, describe, expect, it, vi } from 'vitest';
import { parseTransaction } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { LockedWalletError, browserSigner, chainFor, consoleSigner } from '@/lib/console-wallets/signer';

const KEY = '0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d' as const;
const account = privateKeyToAccount(KEY);
const RPC = 'https://rpc.example.test/ext/bc/C/rpc';
const INFO = {
  name: 'Test chain',
  rpcUrl: RPC,
  explorerUrl: null,
  nativeCurrency: { name: 'AVAX', symbol: 'AVAX', decimals: 18 },
  testnet: true,
};

/** A JSON-RPC node that answers what viem asks before sending, and records the raw transaction. */
function fakeNode() {
  const calls: { url: string; method: string; params: unknown[] }[] = [];
  const answers: Record<string, unknown> = {
    eth_chainId: '0xa869',
    eth_getTransactionCount: '0x7',
    eth_estimateGas: '0x5208',
    eth_gasPrice: '0x5d21dba00',
    eth_maxPriorityFeePerGas: '0x3b9aca00',
    eth_getBlockByNumber: { baseFeePerGas: '0x5d21dba00', number: '0x1', timestamp: '0x1', transactions: [] },
    eth_sendRawTransaction: '0x' + 'ab'.repeat(32),
  };
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init: { body: string }) => {
      const body = JSON.parse(init.body);
      const reply = (req: { id: number; method: string; params: unknown[] }) => {
        calls.push({ url, method: req.method, params: req.params });
        return { jsonrpc: '2.0', id: req.id, result: answers[req.method] ?? null };
      };
      return new Response(JSON.stringify(Array.isArray(body) ? body.map(reply) : reply(body)), {
        headers: { 'content-type': 'application/json' },
      });
    }),
  );
  return calls;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('consoleSigner', () => {
  it('signs the prepared request locally and sends it to the RPC Builder Hub gave', async () => {
    const calls = fakeNode();
    const signer = consoleSigner('w1', account.address, () => account);
    const hash = await signer.send(43113, INFO, {
      to: '0x000000000000000000000000000000000000dEaD',
      data: '0x1234',
      value: '1000',
    });

    expect(hash).toBe('0x' + 'ab'.repeat(32));
    expect(new Set(calls.map((c) => c.url))).toEqual(new Set([RPC]));
    const raw = calls.find((c) => c.method === 'eth_sendRawTransaction')!.params[0] as `0x${string}`;
    const tx = parseTransaction(raw);
    expect(tx).toMatchObject({ chainId: 43113, data: '0x1234', value: 1000n, nonce: 7 });
    expect(tx.to?.toLowerCase()).toBe('0x000000000000000000000000000000000000dead');
    expect(calls.some((c) => c.method === 'eth_sendTransaction')).toBe(false);
  });

  it('stops when the wallet locked in the meantime', async () => {
    fakeNode();
    const signer = consoleSigner('w1', account.address, () => null);
    await expect(signer.send(43113, INFO, { data: '0x', value: '0' })).rejects.toBeInstanceOf(LockedWalletError);
  });

  it('refuses a chain with no RPC from Builder Hub', () => {
    expect(() => chainFor(1, { ...INFO, rpcUrl: null })).toThrow(/no RPC/);
    expect(() => chainFor(1, undefined)).toThrow(/no RPC/);
  });
});

describe('browserSigner', () => {
  it('switches chain then asks the extension to send', async () => {
    const requests: { method: string; params?: unknown[] }[] = [];
    let chainId = '0x1';
    const provider = {
      request: async (args: { method: string; params?: unknown[] }) => {
        requests.push(args);
        if (args.method === 'eth_chainId') return chainId;
        if (args.method === 'wallet_switchEthereumChain') chainId = '0xa869';
        if (args.method === 'eth_sendTransaction') return '0xhash';
        return null;
      },
    };
    const signer = browserSigner(provider as never, account.address);
    await expect(signer.send(43113, INFO, { to: '0xabc', data: '0x12', value: '16' })).resolves.toBe('0xhash');
    expect(requests.map((r) => r.method)).toEqual([
      'eth_chainId',
      'wallet_switchEthereumChain',
      'eth_chainId',
      'eth_sendTransaction',
    ]);
    expect(requests.at(-1)!.params).toEqual([{ from: account.address, to: '0xabc', data: '0x12', value: '0x10' }]);
  });
});
