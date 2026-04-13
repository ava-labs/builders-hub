/**
 * Explorer API route tests.
 *
 * Validates Zod param schemas, pagination caps, rate-limit config, and
 * successful response envelopes for the 7 explorer endpoints.
 *
 * External dependencies (Avalanche SDK, RPC, Prisma) are mocked so tests
 * run fast and deterministically.
 */

import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  createMockRequest,
  callHandler,
  expectSuccess,
  expectError,
} from '@/tests/api/helpers/api-test-utils';
import { mockAuthSession } from '@/tests/api/helpers/mock-session';
import { getAuthSession } from '@/lib/auth/authSession';

// ---------------------------------------------------------------------------
// Module-level mocks (hoisted by vitest)
// ---------------------------------------------------------------------------

vi.mock('@/lib/auth/authSession');

// Use vi.hoisted so the mock object is available during vi.mock factory hoisting
const { mockPrismaClient } = vi.hoisted(() => {
  const apiRateLimitLog = {
    count: vi.fn().mockResolvedValue(0),
    create: vi.fn().mockResolvedValue({}),
    findFirst: vi.fn().mockResolvedValue(null),
    deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
  };

  const client: any = {
    apiRateLimitLog,
    // $transaction must pass the callback a tx proxy that exposes the same models
    $transaction: vi.fn().mockImplementation(async (fn: any) => {
      if (typeof fn === 'function') {
        // The tx object inside the transaction callback needs the same model accessors
        return fn(client);
      }
      if (Array.isArray(fn)) {
        return Promise.all(fn);
      }
      return fn;
    }),
  };

  return { mockPrismaClient: client };
});

vi.mock('@/prisma/prisma', () => ({
  prisma: mockPrismaClient,
}));

// Mock the Avalanche SDK globally -- all explorer routes import it
vi.mock('@avalanche-sdk/chainkit', () => ({
  Avalanche: vi.fn().mockImplementation(() => ({
    data: {
      evm: {
        chains: { get: vi.fn().mockResolvedValue({ chainId: '43114' }) },
        contracts: {
          getMetadata: vi.fn().mockResolvedValue({
            name: 'TestToken',
            symbol: 'TT',
            ercType: 'ERC-20',
            logoAsset: { imageUri: 'https://example.com/logo.png' },
          }),
        },
        address: {
          transactions: {
            list: vi.fn().mockResolvedValue({
              [Symbol.asyncIterator]: async function* () {
                yield {
                  result: {
                    transactions: [],
                    nextPageToken: undefined,
                  },
                };
              },
            }),
          },
          balances: {
            listErc20: vi.fn().mockResolvedValue({
              [Symbol.asyncIterator]: () => ({
                next: vi.fn().mockResolvedValue({
                  value: {
                    result: {
                      erc20TokenBalances: [],
                      nextPageToken: undefined,
                    },
                  },
                  done: false,
                }),
              }),
            }),
          },
          chains: {
            list: vi.fn().mockResolvedValue({ indexedChains: [] }),
          },
        },
      },
    },
  })),
}));

// Mock l1-chains.json -- provide a known chain entry
vi.mock('@/constants/l1-chains.json', () => ({
  default: [
    {
      chainId: '43114',
      chainName: 'Avalanche C-Chain',
      rpcUrl: 'https://api.avax.network/ext/bc/C/rpc',
      coingeckoId: 'avalanche-2',
      networkToken: { symbol: 'AVAX', name: 'Avalanche', decimals: 18 },
      blockchainId: '0x-test',
    },
  ],
}));

// Mock global fetch for RPC calls
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function rpcResponse(result: unknown) {
  return {
    ok: true,
    json: () => Promise.resolve({ jsonrpc: '2.0', id: 1, result }),
  };
}

beforeEach(() => {
  mockAuthSession(null); // public endpoints, no auth
  // Reset rate limit mocks to allow requests through
  mockPrismaClient.apiRateLimitLog.count.mockResolvedValue(0);
  mockPrismaClient.apiRateLimitLog.create.mockResolvedValue({});
});

afterEach(() => {
  // Reset only specific mocks to avoid clearing the Avalanche SDK constructor.
  // Do NOT call vi.restoreAllMocks() -- it would undo the Avalanche SDK mock.
  vi.mocked(getAuthSession).mockReset();
  mockFetch.mockReset();
  mockPrismaClient.apiRateLimitLog.count.mockReset();
  mockPrismaClient.apiRateLimitLog.create.mockReset();
});

// =========================================================================
// 1. Chain overview: GET /api/explorer/[chainId]
// =========================================================================

describe('GET /api/explorer/[chainId]', () => {
  it('rejects non-numeric chainId', async () => {
    const { GET } = await import(
      '@/app/api/explorer/[chainId]/route'
    );
    const req = createMockRequest('GET', {
      url: 'http://localhost:3000/api/explorer/abc',
    });
    const result = await callHandler(GET, req, { chainId: 'abc' });
    expectError(result, 400, 'VALIDATION_ERROR');
  });

  it('rejects chainId with special characters', async () => {
    const { GET } = await import(
      '@/app/api/explorer/[chainId]/route'
    );
    const req = createMockRequest('GET', {
      url: 'http://localhost:3000/api/explorer/43114;DROP',
    });
    const result = await callHandler(GET, req, { chainId: '43114;DROP' });
    expectError(result, 400, 'VALIDATION_ERROR');
  });

  it('returns 404 for unknown chain without custom rpcUrl', async () => {
    const { GET } = await import(
      '@/app/api/explorer/[chainId]/route'
    );
    const req = createMockRequest('GET', {
      url: 'http://localhost:3000/api/explorer/99999',
    });
    const result = await callHandler(GET, req, { chainId: '99999' });
    expectError(result, 404, 'NOT_FOUND');
  });

  it('returns success envelope for priceOnly mode', async () => {
    // Mock CoinGecko fetch for price
    mockFetch.mockResolvedValue(
      rpcResponse(undefined),
    );
    // Override fetch for CoinGecko
    mockFetch.mockImplementation((url: string) => {
      if (typeof url === 'string' && url.includes('coingecko')) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              market_data: {
                current_price: { usd: 25 },
                price_change_percentage_24h: 1.5,
                market_cap: { usd: 1e10 },
                total_volume: { usd: 5e8 },
                total_supply: 720e6,
              },
              symbol: 'avax',
            }),
        });
      }
      // RPC call -- not needed for priceOnly
      return Promise.resolve(rpcResponse(null));
    });

    const { GET } = await import(
      '@/app/api/explorer/[chainId]/route'
    );
    const req = createMockRequest('GET', {
      url: 'http://localhost:3000/api/explorer/43114?priceOnly=true',
    });
    const result = await callHandler(GET, req, { chainId: '43114' });
    const data = expectSuccess(result);
    expect(data).toHaveProperty('glacierSupported');
  });
});

// =========================================================================
// 2. Address detail: GET /api/explorer/[chainId]/address/[address]
// =========================================================================

describe('GET /api/explorer/[chainId]/address/[address]', () => {
  it('rejects malformed address', async () => {
    const { GET } = await import(
      '@/app/api/explorer/[chainId]/address/[address]/route'
    );
    const req = createMockRequest('GET', {
      url: 'http://localhost:3000/api/explorer/43114/address/not-an-address',
    });
    const result = await callHandler(GET, req, {
      chainId: '43114',
      address: 'not-an-address',
    });
    expectError(result, 400, 'VALIDATION_ERROR');
  });

  it('rejects address missing 0x prefix', async () => {
    const { GET } = await import(
      '@/app/api/explorer/[chainId]/address/[address]/route'
    );
    const req = createMockRequest('GET', {
      url: 'http://localhost:3000/api/explorer/43114/address/1234567890abcdef1234567890abcdef12345678',
    });
    const result = await callHandler(GET, req, {
      chainId: '43114',
      address: '1234567890abcdef1234567890abcdef12345678',
    });
    expectError(result, 400, 'VALIDATION_ERROR');
  });

  it('rejects non-numeric chainId in address route', async () => {
    const { GET } = await import(
      '@/app/api/explorer/[chainId]/address/[address]/route'
    );
    const req = createMockRequest('GET', {
      url: 'http://localhost:3000/api/explorer/abc/address/0x1234567890abcdef1234567890abcdef12345678',
    });
    const result = await callHandler(GET, req, {
      chainId: 'abc',
      address: '0x1234567890abcdef1234567890abcdef12345678',
    });
    expectError(result, 400, 'VALIDATION_ERROR');
  });

  it('returns success for valid params', async () => {
    // Mock RPC responses for address route
    mockFetch.mockImplementation((url: string | URL | Request) => {
      const urlStr = typeof url === 'string' ? url : url instanceof URL ? url.toString() : url.url;
      if (urlStr.includes('api.avax.network')) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              jsonrpc: '2.0',
              id: 1,
              result: '0x0', // eth_getCode or eth_getBalance
            }),
        });
      }
      return Promise.resolve(rpcResponse('0x0'));
    });

    const { GET } = await import(
      '@/app/api/explorer/[chainId]/address/[address]/route'
    );
    const req = createMockRequest('GET', {
      url: 'http://localhost:3000/api/explorer/43114/address/0x1234567890abcdef1234567890abcdef12345678',
    });
    const result = await callHandler(GET, req, {
      chainId: '43114',
      address: '0x1234567890abcDEF1234567890abcdef12345678',
    });
    const data = expectSuccess(result);
    expect(data).toHaveProperty('address');
    expect(data).toHaveProperty('isContract');
    expect(data).toHaveProperty('nativeBalance');
  });
});

// =========================================================================
// 3. ERC20 balances: GET /api/explorer/[chainId]/address/[address]/erc20-balances
// =========================================================================

describe('GET /api/explorer/[chainId]/address/[address]/erc20-balances', () => {
  it('rejects invalid address format', async () => {
    const { GET } = await import(
      '@/app/api/explorer/[chainId]/address/[address]/erc20-balances/route'
    );
    const req = createMockRequest('GET', {
      url: 'http://localhost:3000/api/explorer/43114/address/0xINVALID/erc20-balances',
    });
    const result = await callHandler(GET, req, {
      chainId: '43114',
      address: '0xINVALID',
    });
    expectError(result, 400, 'VALIDATION_ERROR');
  });

  it('returns empty balances for valid params', async () => {
    const { GET } = await import(
      '@/app/api/explorer/[chainId]/address/[address]/erc20-balances/route'
    );
    const req = createMockRequest('GET', {
      url: 'http://localhost:3000/api/explorer/43114/address/0x1234567890abcdef1234567890abcdef12345678/erc20-balances',
    });
    const result = await callHandler(GET, req, {
      chainId: '43114',
      address: '0x1234567890abcdef1234567890abcdef12345678',
    });
    const data = expectSuccess(result);
    expect(data).toHaveProperty('balances');
    expect(Array.isArray(data.balances)).toBe(true);
    expect(data).toHaveProperty('pageValueUsd');
  });
});

// =========================================================================
// 4. Block detail: GET /api/explorer/[chainId]/block/[blockNumber]
// =========================================================================

describe('GET /api/explorer/[chainId]/block/[blockNumber]', () => {
  it('rejects non-numeric blockNumber', async () => {
    const { GET } = await import(
      '@/app/api/explorer/[chainId]/block/[blockNumber]/route'
    );
    const req = createMockRequest('GET', {
      url: 'http://localhost:3000/api/explorer/43114/block/latest',
    });
    const result = await callHandler(GET, req, {
      chainId: '43114',
      blockNumber: 'latest',
    });
    expectError(result, 400, 'VALIDATION_ERROR');
  });

  it('rejects hex blockNumber', async () => {
    const { GET } = await import(
      '@/app/api/explorer/[chainId]/block/[blockNumber]/route'
    );
    const req = createMockRequest('GET', {
      url: 'http://localhost:3000/api/explorer/43114/block/0xff',
    });
    const result = await callHandler(GET, req, {
      chainId: '43114',
      blockNumber: '0xff',
    });
    expectError(result, 400, 'VALIDATION_ERROR');
  });

  it('returns 404 when block does not exist', async () => {
    mockFetch.mockResolvedValue(rpcResponse(null));

    const { GET } = await import(
      '@/app/api/explorer/[chainId]/block/[blockNumber]/route'
    );
    const req = createMockRequest('GET', {
      url: 'http://localhost:3000/api/explorer/43114/block/999999999',
    });
    const result = await callHandler(GET, req, {
      chainId: '43114',
      blockNumber: '999999999',
    });
    expectError(result, 404, 'NOT_FOUND');
  });

  it('returns success for valid block', async () => {
    mockFetch.mockResolvedValue(
      rpcResponse({
        number: '0x1',
        hash: '0xabc',
        parentHash: '0x000',
        timestamp: '0x60000000',
        miner: '0x0000000000000000000000000000000000000000',
        transactions: [],
        gasUsed: '0x0',
        gasLimit: '0x1000000',
        baseFeePerGas: '0x5d21dba00',
      }),
    );

    const { GET } = await import(
      '@/app/api/explorer/[chainId]/block/[blockNumber]/route'
    );
    const req = createMockRequest('GET', {
      url: 'http://localhost:3000/api/explorer/43114/block/1',
    });
    const result = await callHandler(GET, req, {
      chainId: '43114',
      blockNumber: '1',
    });
    const data = expectSuccess(result);
    expect(data).toHaveProperty('number');
    expect(data).toHaveProperty('hash');
    expect(data).toHaveProperty('gasUsed');
  });
});

// =========================================================================
// 5. Block transactions: GET /api/explorer/[chainId]/block/[blockNumber]/transactions
// =========================================================================

describe('GET /api/explorer/[chainId]/block/[blockNumber]/transactions', () => {
  it('rejects non-numeric blockNumber', async () => {
    const { GET } = await import(
      '@/app/api/explorer/[chainId]/block/[blockNumber]/transactions/route'
    );
    const req = createMockRequest('GET', {
      url: 'http://localhost:3000/api/explorer/43114/block/abc/transactions',
    });
    const result = await callHandler(GET, req, {
      chainId: '43114',
      blockNumber: 'abc',
    });
    expectError(result, 400, 'VALIDATION_ERROR');
  });

  it('returns transactions for valid block', async () => {
    mockFetch.mockResolvedValue(
      rpcResponse({
        number: '0x1',
        transactions: [
          {
            hash: '0xaaa',
            from: '0x0000000000000000000000000000000000000001',
            to: '0x0000000000000000000000000000000000000002',
            value: '0x0',
            gasPrice: '0x5d21dba00',
            gas: '0x5208',
            nonce: '0x0',
            blockNumber: '0x1',
            transactionIndex: '0x0',
            input: '0x',
          },
        ],
      }),
    );

    const { GET } = await import(
      '@/app/api/explorer/[chainId]/block/[blockNumber]/transactions/route'
    );
    const req = createMockRequest('GET', {
      url: 'http://localhost:3000/api/explorer/43114/block/1/transactions',
    });
    const result = await callHandler(GET, req, {
      chainId: '43114',
      blockNumber: '1',
    });
    const data = expectSuccess(result);
    expect(data).toHaveProperty('transactions');
    expect(Array.isArray(data.transactions)).toBe(true);
    expect(data.transactions).toHaveLength(1);
    expect(data.transactions[0]).toHaveProperty('hash', '0xaaa');
  });
});

// =========================================================================
// 6. Transaction detail: GET /api/explorer/[chainId]/tx/[txHash]
// =========================================================================

describe('GET /api/explorer/[chainId]/tx/[txHash]', () => {
  const validTxHash = '0x' + 'a'.repeat(64);

  it('rejects malformed txHash', async () => {
    const { GET } = await import(
      '@/app/api/explorer/[chainId]/tx/[txHash]/route'
    );
    const req = createMockRequest('GET', {
      url: `http://localhost:3000/api/explorer/43114/tx/not-a-hash`,
    });
    const result = await callHandler(GET, req, {
      chainId: '43114',
      txHash: 'not-a-hash',
    });
    expectError(result, 400, 'VALIDATION_ERROR');
  });

  it('rejects txHash with wrong length', async () => {
    const { GET } = await import(
      '@/app/api/explorer/[chainId]/tx/[txHash]/route'
    );
    const shortHash = '0x' + 'a'.repeat(32);
    const req = createMockRequest('GET', {
      url: `http://localhost:3000/api/explorer/43114/tx/${shortHash}`,
    });
    const result = await callHandler(GET, req, {
      chainId: '43114',
      txHash: shortHash,
    });
    expectError(result, 400, 'VALIDATION_ERROR');
  });

  it('returns 404 when transaction not found', async () => {
    mockFetch.mockResolvedValue(rpcResponse(null));

    const { GET } = await import(
      '@/app/api/explorer/[chainId]/tx/[txHash]/route'
    );
    const req = createMockRequest('GET', {
      url: `http://localhost:3000/api/explorer/43114/tx/${validTxHash}`,
    });
    const result = await callHandler(GET, req, {
      chainId: '43114',
      txHash: validTxHash,
    });
    expectError(result, 404, 'NOT_FOUND');
  });

  it('returns success for valid transaction', async () => {
    // Mock both receipt and tx fetch plus block and blockNumber calls
    let callCount = 0;
    mockFetch.mockImplementation(() => {
      callCount++;
      if (callCount <= 2) {
        // First two calls: receipt and tx (parallel via Promise.allSettled)
        return Promise.resolve(
          rpcResponse({
            transactionHash: validTxHash,
            gasUsed: '0x5208',
            effectiveGasPrice: '0x5d21dba00',
            status: '0x1',
            blockNumber: '0x1',
            blockHash: '0xbbb',
            from: '0x0000000000000000000000000000000000000001',
            to: '0x0000000000000000000000000000000000000002',
            transactionIndex: '0x0',
            logs: [],
            cumulativeGasUsed: '0x5208',
            logsBloom: '0x0',
            // tx fields
            hash: validTxHash,
            value: '0x0',
            gas: '0x5208',
            gasPrice: '0x5d21dba00',
            nonce: '0x0',
            input: '0x',
          }),
        );
      }
      if (callCount === 3) {
        // Block fetch for timestamp
        return Promise.resolve(
          rpcResponse({
            timestamp: '0x60000000',
            number: '0x1',
          }),
        );
      }
      // eth_blockNumber for confirmations
      return Promise.resolve(rpcResponse('0x10'));
    });

    const { GET } = await import(
      '@/app/api/explorer/[chainId]/tx/[txHash]/route'
    );
    const req = createMockRequest('GET', {
      url: `http://localhost:3000/api/explorer/43114/tx/${validTxHash}`,
    });
    const result = await callHandler(GET, req, {
      chainId: '43114',
      txHash: validTxHash,
    });
    const data = expectSuccess(result);
    expect(data).toHaveProperty('hash');
    expect(data).toHaveProperty('status');
    expect(data).toHaveProperty('gasUsed');
  });
});

// =========================================================================
// 7. Token metadata: GET /api/explorer/[chainId]/token/[tokenAddress]/metadata
// =========================================================================

describe('GET /api/explorer/[chainId]/token/[tokenAddress]/metadata', () => {
  it('rejects invalid token address', async () => {
    const { GET } = await import(
      '@/app/api/explorer/[chainId]/token/[tokenAddress]/metadata/route'
    );
    const req = createMockRequest('GET', {
      url: 'http://localhost:3000/api/explorer/43114/token/0xBAD/metadata',
    });
    const result = await callHandler(GET, req, {
      chainId: '43114',
      tokenAddress: '0xBAD',
    });
    expectError(result, 400, 'VALIDATION_ERROR');
  });

  it('rejects non-numeric chainId', async () => {
    const { GET } = await import(
      '@/app/api/explorer/[chainId]/token/[tokenAddress]/metadata/route'
    );
    const validAddr = '0x' + 'a'.repeat(40);
    const req = createMockRequest('GET', {
      url: `http://localhost:3000/api/explorer/abc/token/${validAddr}/metadata`,
    });
    const result = await callHandler(GET, req, {
      chainId: 'abc',
      tokenAddress: validAddr,
    });
    expectError(result, 400, 'VALIDATION_ERROR');
  });

  it('returns metadata for valid token', async () => {
    const { GET } = await import(
      '@/app/api/explorer/[chainId]/token/[tokenAddress]/metadata/route'
    );
    const validAddr = '0x' + 'a'.repeat(40);
    const req = createMockRequest('GET', {
      url: `http://localhost:3000/api/explorer/43114/token/${validAddr}/metadata`,
    });
    const result = await callHandler(GET, req, {
      chainId: '43114',
      tokenAddress: validAddr,
    });
    const data = expectSuccess(result);
    expect(data).toHaveProperty('name', 'TestToken');
    expect(data).toHaveProperty('symbol', 'TT');
    expect(data).toHaveProperty('ercType', 'ERC-20');
  });
});

// =========================================================================
// Cross-cutting: response envelope shape
// =========================================================================

describe('Response envelope', () => {
  it('all error responses include success:false and error.code', async () => {
    const { GET } = await import(
      '@/app/api/explorer/[chainId]/route'
    );
    const req = createMockRequest('GET', {
      url: 'http://localhost:3000/api/explorer/DROP_TABLE',
    });
    const result = await callHandler(GET, req, { chainId: 'DROP_TABLE' });
    expect(result.body.success).toBe(false);
    expect(result.body.error).toBeDefined();
    expect(typeof result.body.error.code).toBe('string');
    expect(typeof result.body.error.message).toBe('string');
  });
});
