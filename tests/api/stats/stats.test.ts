/**
 * Tests for migrated stats / read-only API routes.
 *
 * These routes are data-passthrough so we focus on:
 *  - param validation (chainId format, required query params)
 *  - response envelope shape ({ success, data })
 *  - error codes for bad inputs
 */

import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import {
  createMockRequest,
  callHandler,
  expectSuccess,
  expectError,
} from '@/tests/api/helpers/api-test-utils';
import { mockAuthSession, resetAuthMocks } from '@/tests/api/helpers/mock-session';

// Module-level mocks (hoisted by vitest)
vi.mock('@/lib/auth/authSession');
vi.mock('@/prisma/prisma');

// Mock external SDK / data sources so we never hit the network
vi.mock('@avalanche-sdk/chainkit', () => ({
  Avalanche: vi.fn().mockImplementation(() => ({
    metrics: { networks: { getStakingMetrics: vi.fn().mockResolvedValue([]) } },
    data: {
      primaryNetwork: {
        getNetworkDetails: vi.fn().mockResolvedValue({}),
        listValidators: vi.fn().mockResolvedValue({ [Symbol.asyncIterator]: async function* () {} }),
        listL1Validators: vi.fn().mockResolvedValue({ [Symbol.asyncIterator]: async function* () {} }),
        listSubnets: vi.fn().mockResolvedValue({ [Symbol.asyncIterator]: async function* () {} }),
      },
    },
  })),
}));

vi.mock('@avalanche-sdk/client', () => ({
  createPChainClient: vi.fn().mockReturnValue({
    getCurrentSupply: vi.fn().mockResolvedValue({ supply: BigInt(400_000_000) * BigInt(1_000_000_000) }),
  }),
}));

vi.mock('@avalanche-sdk/client/chains', () => ({
  avalanche: {},
}));

vi.mock('@/lib/icm-clickhouse', () => {
  const mockFlowData: any[] = [];
  return {
    getICMStatsData: vi.fn().mockResolvedValue({ aggregatedData: [], icmDataPoints: [] }),
    getICMContractFeesData: vi.fn().mockResolvedValue({ dataSource: 'mock', lastUpdated: new Date().toISOString(), fees: [] }),
    getICMFlowData: vi.fn().mockImplementation(async () => mockFlowData),
    getChainICMData: vi.fn().mockResolvedValue([]),
    getChainICMCount: vi.fn().mockResolvedValue(0),
  };
});

vi.mock('@/lib/clickhouse', () => ({
  queryClickHouse: vi.fn().mockResolvedValue({ data: [], meta: [], rows: 0, statistics: { elapsed: 0, rows_read: 0, bytes_read: 0 } }),
  C_CHAIN_ID: 43114,
  buildSwapPricesCTE: vi.fn().mockReturnValue('swap_prices AS (SELECT 0 as price_usd, now() as price_hour)'),
  getTotalChainGas: vi.fn().mockResolvedValue({ totalGas: 0, totalTx: 0, totalBurned: 0 }),
  buildContractGasReceivedQuery: vi.fn().mockReturnValue('SELECT 1'),
  buildContractGasGivenQuery: vi.fn().mockReturnValue('SELECT 1'),
  buildContractTxSummaryQuery: vi.fn().mockReturnValue('SELECT 1'),
}));

vi.mock('@/lib/contracts', () => ({
  CONTRACT_REGISTRY: {},
  PROTOCOL_SLUGS: {},
}));

vi.mock('@/lib/source', () => ({
  blog: {
    getPages: vi.fn().mockReturnValue([
      {
        data: { title: 'Test Blog', description: 'A test', date: '2025-01-01' },
        url: '/blog/test',
      },
    ]),
  },
  documentation: { getPages: vi.fn().mockReturnValue([]), getPage: vi.fn().mockReturnValue(null) },
  academy: { getPages: vi.fn().mockReturnValue([]), getPage: vi.fn().mockReturnValue(null) },
  integration: { getPages: vi.fn().mockReturnValue([]), getPage: vi.fn().mockReturnValue(null) },
}));

vi.mock('@/lib/llm-utils', () => ({
  getLLMText: vi.fn().mockResolvedValue('# Mock content'),
}));

vi.mock('@/constants/validator-discovery', () => ({
  MAINNET_VALIDATOR_DISCOVERY_URL: 'https://example.com/mainnet',
  FUJI_VALIDATOR_DISCOVERY_URL: 'https://example.com/fuji',
}));

beforeEach(() => {
  // Public endpoints -- no auth required
  mockAuthSession(null);
});

afterEach(() => {
  resetAuthMocks();
});

// ---------------------------------------------------------------------------
// latest-blogs
// ---------------------------------------------------------------------------

describe('GET /api/latest-blogs', () => {
  it('returns success envelope with blog data', async () => {
    const { GET } = await import('@/app/api/latest-blogs/route');

    const req = createMockRequest('GET', {
      url: 'http://localhost:3000/api/latest-blogs',
    });
    const result = await callHandler(GET, req);
    const data = expectSuccess(result);

    expect(Array.isArray(data)).toBe(true);
    expect(data[0]).toHaveProperty('title');
    expect(data[0]).toHaveProperty('url');
  });
});

// ---------------------------------------------------------------------------
// raw/[...slug] -- path traversal protection
// ---------------------------------------------------------------------------

describe('GET /api/raw/[...slug]', () => {
  /**
   * The raw route uses a catch-all [..slug] param (string[]), so we call
   * the handler directly with the Next.js context shape.
   */
  async function callRawHandler(slug: string[]) {
    const { GET } = await import('@/app/api/raw/[...slug]/route');
    const req = createMockRequest('GET', {
      url: 'http://localhost:3000/api/raw/' + slug.join('/'),
    });
    const context = { params: Promise.resolve({ slug }) };
    const response: Response = await (GET as any)(req, context);
    let body: any;
    try { body = await response.json(); } catch { body = null; }
    return { status: response.status, body, headers: response.headers };
  }

  it('rejects path traversal in slug', async () => {
    const result = await callRawHandler(['docs', '..', '..', 'etc', 'passwd']);
    expectError(result, 400, 'BAD_REQUEST');
  });

  it('rejects empty slug', async () => {
    const result = await callRawHandler([]);
    expectError(result, 400, 'BAD_REQUEST');
  });

  it('rejects invalid content type', async () => {
    const result = await callRawHandler(['invalid']);
    expectError(result, 400, 'BAD_REQUEST');
  });
});

// ---------------------------------------------------------------------------
// calendar/google -- calendarId validation
// ---------------------------------------------------------------------------

describe('GET /api/calendar/google', () => {
  it('rejects missing calendarId', async () => {
    const { GET } = await import('@/app/api/calendar/google/route');

    const req = createMockRequest('GET', {
      url: 'http://localhost:3000/api/calendar/google',
    });
    const result = await callHandler(GET, req);
    expectError(result, 400, 'VALIDATION_ERROR');
  });

  it('rejects calendarId with disallowed characters', async () => {
    const { GET } = await import('@/app/api/calendar/google/route');

    const req = createMockRequest('GET', {
      url: 'http://localhost:3000/api/calendar/google',
      searchParams: { calendarId: 'evil<script>' },
    });
    const result = await callHandler(GET, req);
    expectError(result, 400, 'VALIDATION_ERROR');
  });
});

// ---------------------------------------------------------------------------
// youtube/search -- query validation
// ---------------------------------------------------------------------------

describe('GET /api/youtube/search', () => {
  it('rejects missing query param', async () => {
    const { GET } = await import('@/app/api/youtube/search/route');

    const req = createMockRequest('GET', {
      url: 'http://localhost:3000/api/youtube/search',
    });
    const result = await callHandler(GET, req);
    expectError(result, 400, 'VALIDATION_ERROR');
  });
});

// ---------------------------------------------------------------------------
// dapps/contract-gas-flow -- address validation
// ---------------------------------------------------------------------------

describe('GET /api/dapps/contract-gas-flow', () => {
  it('rejects missing address param', async () => {
    const { GET } = await import('@/app/api/dapps/contract-gas-flow/route');

    const req = createMockRequest('GET', {
      url: 'http://localhost:3000/api/dapps/contract-gas-flow',
    });
    const result = await callHandler(GET, req);
    expectError(result, 400, 'VALIDATION_ERROR');
  });

  it('rejects malformed address', async () => {
    const { GET } = await import('@/app/api/dapps/contract-gas-flow/route');

    const req = createMockRequest('GET', {
      url: 'http://localhost:3000/api/dapps/contract-gas-flow',
      searchParams: { address: 'not-an-address' },
    });
    const result = await callHandler(GET, req);
    expectError(result, 400, 'VALIDATION_ERROR');
  });
});

// ---------------------------------------------------------------------------
// validator-stats -- network param validation
// ---------------------------------------------------------------------------

describe('GET /api/validator-stats', () => {
  it('rejects missing network param', async () => {
    const { GET } = await import('@/app/api/validator-stats/route');

    const req = createMockRequest('GET', {
      url: 'http://localhost:3000/api/validator-stats',
    });
    const result = await callHandler(GET, req);
    expectError(result, 400, 'BAD_REQUEST');
  });

  it('rejects invalid network value', async () => {
    const { GET } = await import('@/app/api/validator-stats/route');

    const req = createMockRequest('GET', {
      url: 'http://localhost:3000/api/validator-stats',
      searchParams: { network: 'devnet' },
    });
    const result = await callHandler(GET, req);
    expectError(result, 400, 'BAD_REQUEST');
  });
});

// ---------------------------------------------------------------------------
// icm-contract-fees -- smoke test
// ---------------------------------------------------------------------------

describe('GET /api/icm-contract-fees', () => {
  it('returns success envelope', async () => {
    const { GET } = await import('@/app/api/icm-contract-fees/route');

    const req = createMockRequest('GET', {
      url: 'http://localhost:3000/api/icm-contract-fees',
    });
    const result = await callHandler(GET, req);
    expect(result.status).toBe(200);
    expect(result.body.success).toBe(true);
    expect(result.body).toHaveProperty('data');
  });
});

// ---------------------------------------------------------------------------
// icm-flow -- smoke test
// ---------------------------------------------------------------------------

describe('GET /api/icm-flow', () => {
  it('returns success envelope with flow data', async () => {
    // Re-mock to ensure the resolved value is a proper array for the `for...of` loop
    const icmMod = await import('@/lib/icm-clickhouse');
    vi.mocked(icmMod.getICMFlowData).mockResolvedValue([]);

    const { GET } = await import('@/app/api/icm-flow/route');

    const req = createMockRequest('GET', {
      url: 'http://localhost:3000/api/icm-flow',
      searchParams: { clearCache: 'true' },
    });
    const result = await callHandler(GET, req);
    expect(result.status).toBe(200);
    expect(result.body.success).toBe(true);
    expect(result.body.data).toHaveProperty('flows');
    expect(result.body.data).toHaveProperty('totalMessages');
  });
});
