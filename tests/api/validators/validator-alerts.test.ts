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
  resetAuthMocks,
} from '@/tests/api/helpers/mock-session';
import { prisma } from '@/prisma/prisma';

// ---------------------------------------------------------------------------
// Module-level mocks (hoisted by vitest)
// ---------------------------------------------------------------------------

vi.mock('@/lib/auth/authSession');
vi.mock('@/prisma/prisma');
vi.mock('@/server/services/validator-alert-check');
vi.mock('@/server/services/l1-chain-metadata');

// ---------------------------------------------------------------------------
// Shared fixtures
// ---------------------------------------------------------------------------

const VALID_NODE_ID = 'NodeID-5dDZRhaMaa3ePRfiMVMJGKsTavRGF9Evt';
const ALERT_ID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';

const MOCK_ALERT = {
  id: ALERT_ID,
  user_id: 'test-user-id',
  node_id: VALID_NODE_ID,
  subnet_id: 'primary',
  label: 'My Validator',
  uptime_alert: true,
  uptime_threshold: 95,
  version_alert: true,
  expiry_alert: true,
  expiry_days: 7,
  balance_alert: false,
  balance_threshold: 5000000000,
  balance_threshold_days: 30,
  security_alert: false,
  last_known_ip: '1.2.3.4',
  email: 'test@example.com',
  active: true,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  alert_logs: [],
};

// ---------------------------------------------------------------------------
// Lifecycle
// ---------------------------------------------------------------------------

let mockedPrisma: any;

beforeEach(() => {
  vi.clearAllMocks();

  // Set up the Prisma mock so route-side calls work
  mockedPrisma = vi.mocked(prisma) as any;

  mockedPrisma.validatorAlert = {
    findMany: vi.fn().mockResolvedValue([]),
    findFirst: vi.fn().mockResolvedValue(null),
    findUnique: vi.fn().mockResolvedValue(null),
    create: vi.fn().mockResolvedValue(MOCK_ALERT),
    update: vi.fn().mockResolvedValue(MOCK_ALERT),
    delete: vi.fn().mockResolvedValue(MOCK_ALERT),
    count: vi.fn().mockResolvedValue(0),
  };

  mockedPrisma.validatorAlertLog = {
    findFirst: vi.fn().mockResolvedValue(null),
    create: vi.fn().mockResolvedValue({}),
  };

  mockedPrisma.$transaction = vi.fn(async (arg: unknown) => {
    if (typeof arg === 'function') {
      return arg(mockedPrisma);
    }
    if (Array.isArray(arg)) return Promise.all(arg);
    return arg;
  });

  // Mock the global fetch used by POST to verify validators exist
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [{ node_id: VALID_NODE_ID, public_ip: '1.2.3.4' }],
    }),
  );
});

afterEach(() => {
  resetAuthMocks();
  vi.unstubAllGlobals();
});

// ===========================================================================
// GET /api/validator-alerts — list user's alerts
// ===========================================================================

describe('GET /api/validator-alerts', () => {
  it('returns alerts for authenticated user', async () => {
    const session = createMockSession();
    mockAuthSession(session);

    mockedPrisma.validatorAlert.findMany.mockResolvedValue([MOCK_ALERT]);

    const { GET } = await import('@/app/api/validator-alerts/route');
    const req = createMockRequest('GET', {
      url: 'http://localhost:3000/api/validator-alerts',
    });

    const result = await callHandler(GET, req);
    const data = expectSuccess(result);
    expect(data).toHaveLength(1);
    expect(data[0].node_id).toBe(VALID_NODE_ID);
  });

  it('returns 401 when unauthenticated', async () => {
    mockAuthSession(null);

    const { GET } = await import('@/app/api/validator-alerts/route');
    const req = createMockRequest('GET', {
      url: 'http://localhost:3000/api/validator-alerts',
    });

    const result = await callHandler(GET, req);
    expectError(result, 401, 'AUTH_REQUIRED');
  });
});

// ===========================================================================
// POST /api/validator-alerts — create alert
// ===========================================================================

describe('POST /api/validator-alerts', () => {
  it('creates an alert for a valid node', async () => {
    const session = createMockSession();
    mockAuthSession(session);

    const { fetchLatestRelease, checkSingleAlert, sendWelcomeEmail } = await import(
      '@/server/services/validator-alert-check'
    );
    vi.mocked(fetchLatestRelease).mockResolvedValue(null);
    vi.mocked(checkSingleAlert).mockResolvedValue({ sent: 0, errors: [] });
    vi.mocked(sendWelcomeEmail).mockResolvedValue(undefined as any);

    // Override $transaction to use a mock tx client with correct behavior
    mockedPrisma.$transaction.mockImplementation(async (fn: Function) => {
      const txClient = {
        validatorAlert: {
          count: vi.fn().mockResolvedValue(0),
          findUnique: vi.fn().mockResolvedValue(null),
          create: vi.fn().mockResolvedValue(MOCK_ALERT),
        },
      };
      return fn(txClient);
    });

    mockedPrisma.validatorAlert.findUnique.mockResolvedValue(MOCK_ALERT);

    const { POST } = await import('@/app/api/validator-alerts/route');
    const req = createMockRequest('POST', {
      url: 'http://localhost:3000/api/validator-alerts',
      body: { node_id: VALID_NODE_ID },
    });

    const result = await callHandler(POST, req);
    const data = expectSuccess(result, 201);
    expect(data.node_id).toBe(VALID_NODE_ID);
  });

  it('returns 401 when unauthenticated', async () => {
    mockAuthSession(null);

    const { POST } = await import('@/app/api/validator-alerts/route');
    const req = createMockRequest('POST', {
      url: 'http://localhost:3000/api/validator-alerts',
      body: { node_id: VALID_NODE_ID },
    });

    const result = await callHandler(POST, req);
    expectError(result, 401, 'AUTH_REQUIRED');
  });

  it('rejects invalid node ID format', async () => {
    const session = createMockSession();
    mockAuthSession(session);

    const { POST } = await import('@/app/api/validator-alerts/route');
    const req = createMockRequest('POST', {
      url: 'http://localhost:3000/api/validator-alerts',
      body: { node_id: 'not-a-valid-node' },
    });

    const result = await callHandler(POST, req);
    expectError(result, 400, 'VALIDATION_ERROR');
  });

  it('rejects node ID missing NodeID- prefix', async () => {
    const session = createMockSession();
    mockAuthSession(session);

    const { POST } = await import('@/app/api/validator-alerts/route');
    const req = createMockRequest('POST', {
      url: 'http://localhost:3000/api/validator-alerts',
      body: { node_id: 'abc123' },
    });

    const result = await callHandler(POST, req);
    expectError(result, 400, 'VALIDATION_ERROR');
  });

  it('rejects uptime_threshold > 100', async () => {
    const session = createMockSession();
    mockAuthSession(session);

    const { POST } = await import('@/app/api/validator-alerts/route');
    const req = createMockRequest('POST', {
      url: 'http://localhost:3000/api/validator-alerts',
      body: { node_id: VALID_NODE_ID, uptime_threshold: 150 },
    });

    const result = await callHandler(POST, req);
    expectError(result, 400, 'VALIDATION_ERROR');
  });

  it('rejects expiry_days > 365', async () => {
    const session = createMockSession();
    mockAuthSession(session);

    const { POST } = await import('@/app/api/validator-alerts/route');
    const req = createMockRequest('POST', {
      url: 'http://localhost:3000/api/validator-alerts',
      body: { node_id: VALID_NODE_ID, expiry_days: 999 },
    });

    const result = await callHandler(POST, req);
    expectError(result, 400, 'VALIDATION_ERROR');
  });

  it('rejects negative balance_threshold', async () => {
    const session = createMockSession();
    mockAuthSession(session);

    const { POST } = await import('@/app/api/validator-alerts/route');
    const req = createMockRequest('POST', {
      url: 'http://localhost:3000/api/validator-alerts',
      body: { node_id: VALID_NODE_ID, balance_threshold: -1 },
    });

    const result = await callHandler(POST, req);
    expectError(result, 400, 'VALIDATION_ERROR');
  });

  it('rejects invalid email format', async () => {
    const session = createMockSession();
    mockAuthSession(session);

    const { POST } = await import('@/app/api/validator-alerts/route');
    const req = createMockRequest('POST', {
      url: 'http://localhost:3000/api/validator-alerts',
      body: { node_id: VALID_NODE_ID, email: 'not-an-email' },
    });

    const result = await callHandler(POST, req);
    expectError(result, 400, 'VALIDATION_ERROR');
  });

  it('returns 409 for duplicate alert (same node + subnet)', async () => {
    const session = createMockSession();
    mockAuthSession(session);

    mockedPrisma.$transaction.mockImplementation(async (fn: Function) => {
      const txClient = {
        validatorAlert: {
          count: vi.fn().mockResolvedValue(0),
          findUnique: vi.fn().mockResolvedValue(MOCK_ALERT), // already exists
          create: vi.fn(),
        },
      };
      return fn(txClient);
    });

    const { POST } = await import('@/app/api/validator-alerts/route');
    const req = createMockRequest('POST', {
      url: 'http://localhost:3000/api/validator-alerts',
      body: { node_id: VALID_NODE_ID },
    });

    const result = await callHandler(POST, req);
    expectError(result, 409, 'CONFLICT');
  });

  it('returns 429 when user exceeds max alerts', async () => {
    const session = createMockSession();
    mockAuthSession(session);

    mockedPrisma.$transaction.mockImplementation(async (fn: Function) => {
      const txClient = {
        validatorAlert: {
          count: vi.fn().mockResolvedValue(20), // at limit
          findUnique: vi.fn(),
          create: vi.fn(),
        },
      };
      return fn(txClient);
    });

    const { POST } = await import('@/app/api/validator-alerts/route');
    const req = createMockRequest('POST', {
      url: 'http://localhost:3000/api/validator-alerts',
      body: { node_id: VALID_NODE_ID },
    });

    const result = await callHandler(POST, req);
    expectError(result, 429, 'RATE_LIMITED');
  });
});

// ===========================================================================
// GET /api/validator-alerts/[id] — get single alert
// ===========================================================================

describe('GET /api/validator-alerts/[id]', () => {
  it('returns the alert owned by the user', async () => {
    const session = createMockSession();
    mockAuthSession(session);

    mockedPrisma.validatorAlert.findFirst.mockResolvedValue(MOCK_ALERT);

    const { GET } = await import('@/app/api/validator-alerts/[id]/route');
    const req = createMockRequest('GET', {
      url: `http://localhost:3000/api/validator-alerts/${ALERT_ID}`,
    });

    const result = await callHandler(GET, req, { id: ALERT_ID });
    const data = expectSuccess(result);
    expect(data.id).toBe(ALERT_ID);
  });

  it('returns 404 for alert not owned by user', async () => {
    const session = createMockSession();
    mockAuthSession(session);

    mockedPrisma.validatorAlert.findFirst.mockResolvedValue(null);

    const { GET } = await import('@/app/api/validator-alerts/[id]/route');
    const req = createMockRequest('GET', {
      url: `http://localhost:3000/api/validator-alerts/${ALERT_ID}`,
    });

    const result = await callHandler(GET, req, { id: ALERT_ID });
    expectError(result, 404, 'NOT_FOUND');
  });

  it('returns 400 for invalid UUID param', async () => {
    const session = createMockSession();
    mockAuthSession(session);

    const { GET } = await import('@/app/api/validator-alerts/[id]/route');
    const req = createMockRequest('GET', {
      url: 'http://localhost:3000/api/validator-alerts/not-a-uuid',
    });

    const result = await callHandler(GET, req, { id: 'not-a-uuid' });
    expectError(result, 400, 'VALIDATION_ERROR');
  });

  it('returns 401 when unauthenticated', async () => {
    mockAuthSession(null);

    const { GET } = await import('@/app/api/validator-alerts/[id]/route');
    const req = createMockRequest('GET', {
      url: `http://localhost:3000/api/validator-alerts/${ALERT_ID}`,
    });

    const result = await callHandler(GET, req, { id: ALERT_ID });
    expectError(result, 401, 'AUTH_REQUIRED');
  });
});

// ===========================================================================
// PUT /api/validator-alerts/[id] — update alert
// ===========================================================================

describe('PUT /api/validator-alerts/[id]', () => {
  it('updates alert fields', async () => {
    const session = createMockSession();
    mockAuthSession(session);

    mockedPrisma.validatorAlert.findFirst.mockResolvedValue(MOCK_ALERT);
    mockedPrisma.validatorAlert.update.mockResolvedValue({
      ...MOCK_ALERT,
      uptime_threshold: 90,
      label: 'Updated Label',
    });

    const { PUT } = await import('@/app/api/validator-alerts/[id]/route');
    const req = createMockRequest('PUT', {
      url: `http://localhost:3000/api/validator-alerts/${ALERT_ID}`,
      body: { uptime_threshold: 90, label: 'Updated Label' },
    });

    const result = await callHandler(PUT, req, { id: ALERT_ID });
    const data = expectSuccess(result);
    expect(data.uptime_threshold).toBe(90);
    expect(data.label).toBe('Updated Label');
  });

  it('rejects enabling balance alerts on primary network validator', async () => {
    const session = createMockSession();
    mockAuthSession(session);

    mockedPrisma.validatorAlert.findFirst.mockResolvedValue(MOCK_ALERT); // subnet_id = 'primary'

    const { PUT } = await import('@/app/api/validator-alerts/[id]/route');
    const req = createMockRequest('PUT', {
      url: `http://localhost:3000/api/validator-alerts/${ALERT_ID}`,
      body: { balance_alert: true },
    });

    const result = await callHandler(PUT, req, { id: ALERT_ID });
    expectError(result, 400, 'BAD_REQUEST');
  });

  it('rejects enabling uptime alerts on L1 validator', async () => {
    const session = createMockSession();
    mockAuthSession(session);

    const l1Alert = { ...MOCK_ALERT, subnet_id: 'some-l1-subnet-id' };
    mockedPrisma.validatorAlert.findFirst.mockResolvedValue(l1Alert);

    const { PUT } = await import('@/app/api/validator-alerts/[id]/route');
    const req = createMockRequest('PUT', {
      url: `http://localhost:3000/api/validator-alerts/${ALERT_ID}`,
      body: { uptime_alert: true },
    });

    const result = await callHandler(PUT, req, { id: ALERT_ID });
    expectError(result, 400, 'BAD_REQUEST');
  });

  it('rejects invalid uptime_threshold via Zod', async () => {
    const session = createMockSession();
    mockAuthSession(session);

    const { PUT } = await import('@/app/api/validator-alerts/[id]/route');
    const req = createMockRequest('PUT', {
      url: `http://localhost:3000/api/validator-alerts/${ALERT_ID}`,
      body: { uptime_threshold: 150 },
    });

    const result = await callHandler(PUT, req, { id: ALERT_ID });
    expectError(result, 400, 'VALIDATION_ERROR');
  });

  it('rejects invalid email format via Zod', async () => {
    const session = createMockSession();
    mockAuthSession(session);

    const { PUT } = await import('@/app/api/validator-alerts/[id]/route');
    const req = createMockRequest('PUT', {
      url: `http://localhost:3000/api/validator-alerts/${ALERT_ID}`,
      body: { email: 'bad-email' },
    });

    const result = await callHandler(PUT, req, { id: ALERT_ID });
    expectError(result, 400, 'VALIDATION_ERROR');
  });

  it('returns 404 for alert not owned by user', async () => {
    const session = createMockSession();
    mockAuthSession(session);

    mockedPrisma.validatorAlert.findFirst.mockResolvedValue(null);

    const { PUT } = await import('@/app/api/validator-alerts/[id]/route');
    const req = createMockRequest('PUT', {
      url: `http://localhost:3000/api/validator-alerts/${ALERT_ID}`,
      body: { label: 'new' },
    });

    const result = await callHandler(PUT, req, { id: ALERT_ID });
    expectError(result, 404, 'NOT_FOUND');
  });

  it('returns 401 when unauthenticated', async () => {
    mockAuthSession(null);

    const { PUT } = await import('@/app/api/validator-alerts/[id]/route');
    const req = createMockRequest('PUT', {
      url: `http://localhost:3000/api/validator-alerts/${ALERT_ID}`,
      body: { label: 'new' },
    });

    const result = await callHandler(PUT, req, { id: ALERT_ID });
    expectError(result, 401, 'AUTH_REQUIRED');
  });
});

// ===========================================================================
// DELETE /api/validator-alerts/[id] — delete alert
// ===========================================================================

describe('DELETE /api/validator-alerts/[id]', () => {
  it('deletes an alert owned by user and returns 204', async () => {
    const session = createMockSession();
    mockAuthSession(session);

    mockedPrisma.validatorAlert.findFirst.mockResolvedValue(MOCK_ALERT);
    mockedPrisma.validatorAlert.delete.mockResolvedValue(MOCK_ALERT);

    const { DELETE } = await import('@/app/api/validator-alerts/[id]/route');
    const req = createMockRequest('DELETE', {
      url: `http://localhost:3000/api/validator-alerts/${ALERT_ID}`,
    });

    const result = await callHandler(DELETE, req, { id: ALERT_ID });
    expect(result.status).toBe(204);
  });

  it('returns 404 when alert does not belong to user', async () => {
    const session = createMockSession();
    mockAuthSession(session);

    mockedPrisma.validatorAlert.findFirst.mockResolvedValue(null);

    const { DELETE } = await import('@/app/api/validator-alerts/[id]/route');
    const req = createMockRequest('DELETE', {
      url: `http://localhost:3000/api/validator-alerts/${ALERT_ID}`,
    });

    const result = await callHandler(DELETE, req, { id: ALERT_ID });
    expectError(result, 404, 'NOT_FOUND');
  });

  it('returns 401 when unauthenticated', async () => {
    mockAuthSession(null);

    const { DELETE } = await import('@/app/api/validator-alerts/[id]/route');
    const req = createMockRequest('DELETE', {
      url: `http://localhost:3000/api/validator-alerts/${ALERT_ID}`,
    });

    const result = await callHandler(DELETE, req, { id: ALERT_ID });
    expectError(result, 401, 'AUTH_REQUIRED');
  });
});
