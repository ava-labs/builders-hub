import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  createMockRequest,
  callHandler,
  expectSuccess,
  expectError,
} from '@/tests/api/helpers/api-test-utils';
import {
  createMockSession,
  mockAuthSession,
} from '@/tests/api/helpers/mock-session';
import { getAuthSession } from '@/lib/auth/authSession';

// ---------------------------------------------------------------------------
// Module-level mocks (hoisted by vitest)
// ---------------------------------------------------------------------------

vi.mock('@/lib/auth/authSession');

// Mock the Avalanche SDK used by validator-details, chain-validators, geolocation.
// Each method returns a fresh async iterable on every call so iterators never exhaust.
function makeAsyncIterable<T>(pages: T[]) {
  return {
    async *[Symbol.asyncIterator]() {
      for (const page of pages) yield page;
    },
  };
}

const MOCK_VALIDATOR_PAGE = {
  result: {
    validators: [
      {
        nodeId: 'NodeID-5dDZRhaMaa3ePRfiMVMJGKsTavRGF9Evt',
        validationStatus: 'active',
        txHash: '0xabc',
        subnetId: '11111111111111111111111111111111LpoYY',
        amountStaked: '2000000000000',
        delegationFee: '2',
        startTimestamp: 1000000,
        endTimestamp: 9999999,
        stakePercentage: 0.01,
        delegatorCount: 5,
        amountDelegated: '500000000000',
        uptimePerformance: 99.5,
        delegationCapacity: '1000000000000',
        geolocation: {
          city: 'New York',
          country: 'United States',
          countryCode: 'US',
          latitude: 40.7,
          longitude: -74.0,
        },
        avalancheGoVersion: 'v1.12.0',
      },
    ],
  },
};

vi.mock('@avalanche-sdk/chainkit', () => ({
  Avalanche: vi.fn().mockImplementation(() => ({
    data: {
      primaryNetwork: {
        getValidatorDetails: vi.fn().mockImplementation(() =>
          Promise.resolve(makeAsyncIterable([MOCK_VALIDATOR_PAGE])),
        ),
        listValidators: vi.fn().mockImplementation(() =>
          Promise.resolve(makeAsyncIterable([MOCK_VALIDATOR_PAGE])),
        ),
        listL1Validators: vi.fn().mockImplementation(() =>
          Promise.resolve(makeAsyncIterable([{ result: { validators: [] } }])),
        ),
      },
    },
  })),
}));

// Mock the validator discovery constants
vi.mock('@/constants/validator-discovery', () => ({
  MAINNET_VALIDATOR_DISCOVERY_URL: 'https://example.com/mainnet',
  FUJI_VALIDATOR_DISCOVERY_URL: 'https://example.com/fuji',
}));

// Mock STATS_CONFIG for validator-details route
vi.mock('@/types/stats', () => ({
  STATS_CONFIG: {
    CACHE: {
      LONG_DURATION: 3600000, // 1 hour
    },
  },
}));

// ---------------------------------------------------------------------------
// Shared fixtures
// ---------------------------------------------------------------------------

const VALID_NODE_ID = 'NodeID-5dDZRhaMaa3ePRfiMVMJGKsTavRGF9Evt';

const MOCK_UPSTREAM_VALIDATORS = [
  {
    node_id: VALID_NODE_ID,
    p50_uptime: 99.5,
    weight: 2000000000000,
    delegator_count: 5,
    delegator_weight: 500000000000,
    delegation_fee: 2,
    potential_reward: 100000000,
    bench_observers: 0,
    end_time: '2025-12-31T00:00:00Z',
    version: 'v1.12.0',
    tracked_subnets: '',
    public_ip: '1.2.3.4',
    total_stake: 2500000000000,
    days_left: 365,
    miss_rate_14d: 0.01,
    miss_count_14d: 2,
    block_count_14d: 200,
  },
];

const MOCK_UPSTREAM_DETAIL = {
  node_id: VALID_NODE_ID,
  current_p50_uptime: 99.5,
  bench_observers: 0,
  weight: 2000000000000,
  delegator_weight: 500000000000,
  delegator_count: 5,
  delegation_fee: 2,
  potential_reward: 100000000,
  version: 'v1.12.0',
  public_ip: '1.2.3.4',
  days_left: 365,
  miss_rate_14d: 0.01,
  missed_14d: 2,
  proposed_14d: 200,
  uptime_details: { count: 100, min: 95, max: 100, avg: 99, p50: 99.5, p95: 100 },
  uptime: [],
  bench: [],
  blocks: [],
  slots: [],
};

// ---------------------------------------------------------------------------
// Lifecycle
// ---------------------------------------------------------------------------

beforeEach(() => {
  // NOTE: do not call vi.clearAllMocks() here -- it would wipe the SDK
  // mock implementations (Avalanche constructor, listValidators, etc.)
  // which are defined in the vi.mock factory and cached across tests.

  // Default fetch mock that returns upstream validator data
  vi.stubGlobal(
    'fetch',
    vi.fn().mockImplementation((url: string) => {
      if (url.includes('/api/validators/')) {
        return Promise.resolve({
          ok: true,
          json: async () => MOCK_UPSTREAM_DETAIL,
        });
      }
      if (url.includes('/api/validators')) {
        return Promise.resolve({
          ok: true,
          json: async () => MOCK_UPSTREAM_VALIDATORS,
        });
      }
      // Version discovery
      return Promise.resolve({
        ok: true,
        json: async () => [{ nodeId: VALID_NODE_ID, version: 'avalanchego/v1.12.0' }],
      });
    }),
  );
});

afterEach(() => {
  // Only reset the auth session mock, not ALL mocks -- vi.restoreAllMocks()
  // (called by resetAuthMocks) would wipe SDK mock implementations.
  vi.mocked(getAuthSession).mockReset();
  vi.unstubAllGlobals();
});

// ===========================================================================
// GET /api/validators — list all validators (public)
// ===========================================================================

describe('GET /api/validators', () => {
  it('returns validators from upstream API', async () => {
    mockAuthSession(null);

    const { GET } = await import('@/app/api/validators/route');
    const req = createMockRequest('GET', {
      url: 'http://localhost:3000/api/validators',
    });

    const result = await callHandler(GET, req);
    const data = expectSuccess(result);
    expect(Array.isArray(data)).toBe(true);
    expect(data).toHaveLength(1);
    expect(data[0].node_id).toBe(VALID_NODE_ID);
  });

  it('does not require authentication', async () => {
    mockAuthSession(null);

    const { GET } = await import('@/app/api/validators/route');
    const req = createMockRequest('GET', {
      url: 'http://localhost:3000/api/validators',
    });

    const result = await callHandler(GET, req);
    expect(result.status).toBe(200);
  });

  it('returns 500 when upstream fails and no cache', async () => {
    mockAuthSession(null);

    vi.stubGlobal(
      'fetch',
      vi.fn().mockRejectedValue(new Error('network error')),
    );

    // Need a fresh import to avoid the module-level cache from previous tests
    vi.resetModules();
    const { GET } = await import('@/app/api/validators/route');
    const req = createMockRequest('GET', {
      url: 'http://localhost:3000/api/validators',
    });

    const result = await callHandler(GET, req);
    expectError(result, 500, 'INTERNAL_ERROR');
  });
});

// ===========================================================================
// GET /api/validators/[nodeId] — single validator detail (public)
// ===========================================================================

describe('GET /api/validators/[nodeId]', () => {
  it('returns detail for a valid node ID', async () => {
    mockAuthSession(null);

    const { GET } = await import('@/app/api/validators/[nodeId]/route');
    const req = createMockRequest('GET', {
      url: `http://localhost:3000/api/validators/${VALID_NODE_ID}`,
    });

    const result = await callHandler(GET, req, { nodeId: VALID_NODE_ID });
    const data = expectSuccess(result);
    expect(data.node_id).toBe(VALID_NODE_ID);
  });

  it('rejects invalid node ID format', async () => {
    mockAuthSession(null);

    const { GET } = await import('@/app/api/validators/[nodeId]/route');
    const req = createMockRequest('GET', {
      url: 'http://localhost:3000/api/validators/invalid-node',
    });

    const result = await callHandler(GET, req, { nodeId: 'invalid-node' });
    expectError(result, 400, 'VALIDATION_ERROR');
  });

  it('rejects node ID without NodeID- prefix', async () => {
    mockAuthSession(null);

    const { GET } = await import('@/app/api/validators/[nodeId]/route');
    const req = createMockRequest('GET', {
      url: 'http://localhost:3000/api/validators/justbase58string',
    });

    const result = await callHandler(GET, req, { nodeId: 'justbase58string' });
    expectError(result, 400, 'VALIDATION_ERROR');
  });

  it('does not require authentication', async () => {
    mockAuthSession(null);

    const { GET } = await import('@/app/api/validators/[nodeId]/route');
    const req = createMockRequest('GET', {
      url: `http://localhost:3000/api/validators/${VALID_NODE_ID}`,
    });

    const result = await callHandler(GET, req, { nodeId: VALID_NODE_ID });
    expect(result.status).toBe(200);
  });
});

// ===========================================================================
// GET /api/validator-details/[nodeId] — SDK-backed detail (public)
// ===========================================================================

describe('GET /api/validator-details/[nodeId]', () => {
  it('returns validator details from SDK', async () => {
    mockAuthSession(null);

    vi.resetModules();
    const { GET } = await import('@/app/api/validator-details/[nodeId]/route');
    const req = createMockRequest('GET', {
      url: `http://localhost:3000/api/validator-details/${VALID_NODE_ID}`,
    });

    const result = await callHandler(GET, req, { nodeId: VALID_NODE_ID });
    const data = expectSuccess(result);
    expect(data.validatorDetails).toBeDefined();
    expect(data.validatorDetails.nodeId).toBe(VALID_NODE_ID);
  });

  it('rejects invalid node ID', async () => {
    mockAuthSession(null);

    const { GET } = await import('@/app/api/validator-details/[nodeId]/route');
    const req = createMockRequest('GET', {
      url: 'http://localhost:3000/api/validator-details/not-valid',
    });

    const result = await callHandler(GET, req, { nodeId: 'not-valid' });
    expectError(result, 400, 'VALIDATION_ERROR');
  });
});

// ===========================================================================
// GET /api/chain-validators/[subnetId] — validators by subnet (public)
// ===========================================================================

describe('GET /api/chain-validators/[subnetId]', () => {
  it('returns validators for a subnet', async () => {
    mockAuthSession(null);

    const { GET } = await import('@/app/api/chain-validators/[subnetId]/route');
    const req = createMockRequest('GET', {
      url: 'http://localhost:3000/api/chain-validators/11111111111111111111111111111111LpoYY',
    });

    const result = await callHandler(GET, req, {
      subnetId: '11111111111111111111111111111111LpoYY',
    });
    const data = expectSuccess(result);
    expect(data.validators).toBeDefined();
    expect(data.subnetId).toBe('11111111111111111111111111111111LpoYY');
    expect(data.totalCount).toBeGreaterThanOrEqual(0);
  });

  it('rejects empty subnet ID', async () => {
    mockAuthSession(null);

    const { GET } = await import('@/app/api/chain-validators/[subnetId]/route');
    const req = createMockRequest('GET', {
      url: 'http://localhost:3000/api/chain-validators/',
    });

    const result = await callHandler(GET, req, { subnetId: '' });
    expectError(result, 400, 'VALIDATION_ERROR');
  });

  it('does not require authentication', async () => {
    mockAuthSession(null);

    const { GET } = await import('@/app/api/chain-validators/[subnetId]/route');
    const req = createMockRequest('GET', {
      url: 'http://localhost:3000/api/chain-validators/11111111111111111111111111111111LpoYY',
    });

    const result = await callHandler(GET, req, {
      subnetId: '11111111111111111111111111111111LpoYY',
    });
    expect(result.status).toBe(200);
  });
});

// ===========================================================================
// GET /api/validator-geolocation — geolocation data (public)
// ===========================================================================

describe('GET /api/validator-geolocation', () => {
  it('returns geolocation aggregation data', async () => {
    mockAuthSession(null);
    const { GET } = await import('@/app/api/validator-geolocation/route');
    const req = createMockRequest('GET', {
      url: 'http://localhost:3000/api/validator-geolocation',
    });

    const result = await callHandler(GET, req);
    const data = expectSuccess(result);
    expect(Array.isArray(data)).toBe(true);
    if (data.length > 0) {
      expect(data[0]).toHaveProperty('country');
      expect(data[0]).toHaveProperty('countryCode');
      expect(data[0]).toHaveProperty('validators');
      expect(data[0]).toHaveProperty('totalStaked');
      expect(data[0]).toHaveProperty('x');
      expect(data[0]).toHaveProperty('y');
    }
  });

  it('does not require authentication', async () => {
    mockAuthSession(null);
    // Reuse the already-imported module (cache populated by prior test)
    const { GET } = await import('@/app/api/validator-geolocation/route');
    const req = createMockRequest('GET', {
      url: 'http://localhost:3000/api/validator-geolocation',
    });

    const result = await callHandler(GET, req);
    expect(result.status).toBe(200);
  });
});
