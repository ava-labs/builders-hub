import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';

// vi.hoisted runs in the hoisted context alongside vi.mock
const { mockPrisma } = vi.hoisted(() => {
  const METHODS = [
    'findFirst', 'findMany', 'findUnique', 'create', 'createMany',
    'update', 'updateMany', 'delete', 'deleteMany', 'upsert', 'count',
    'aggregate', 'groupBy',
  ] as const;

  type MockModel = { [K in (typeof METHODS)[number]]: ReturnType<typeof vi.fn> };

  function createModel(): MockModel {
    const m = {} as MockModel;
    for (const method of METHODS) m[method] = vi.fn();
    return m;
  }

  const cache = new Map<string, MockModel>();
  const proxy = new Proxy({} as Record<string, any>, {
    get(_t, prop: string) {
      if (prop === '$transaction') return vi.fn(async (arg: unknown) => typeof arg === 'function' ? arg(proxy) : Array.isArray(arg) ? Promise.all(arg) : arg);
      if (prop === 'then' || prop === 'toJSON' || typeof prop === 'symbol') return undefined;
      if (!cache.has(prop)) cache.set(prop, createModel());
      return cache.get(prop)!;
    },
  });

  return { mockPrisma: proxy };
});

// Module-level mocks (hoisted by vitest)
vi.mock('@/prisma/prisma', () => ({ prisma: mockPrisma }));
vi.mock('@/lib/auth/authSession');

import {
  createMockRequest,
  callHandler,
  expectSuccess,
  expectError,
} from '@/tests/api/helpers/api-test-utils';
import {
  createMockSession,
  createAdminSession,
  mockAuthSession,
  resetAuthMocks,
} from '@/tests/api/helpers/mock-session';

// Dynamic imports so mocks are in place
const evaluateModule = () => import('@/app/api/evaluate/route');
const submissionsModule = () => import('@/app/api/evaluate/submissions/route');
const advanceStageModule = () => import('@/app/api/evaluate/advance-stage/route');
const finalVerdictModule = () => import('@/app/api/evaluate/final-verdict/route');

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const judgeSession = createMockSession({
  id: 'judge-1',
  email: 'judge@example.com',
  custom_attributes: ['judge'],
});

const devrelSession = createAdminSession();

const regularSession = createMockSession({
  email: 'regular@example.com',
  custom_attributes: [],
});

// ---------------------------------------------------------------------------
// Lifecycle
// ---------------------------------------------------------------------------

beforeEach(() => vi.clearAllMocks());
afterEach(() => resetAuthMocks());

// ---------------------------------------------------------------------------
// POST /api/evaluate  -- submit an evaluation
// ---------------------------------------------------------------------------

describe('POST /api/evaluate', () => {
  it('creates an evaluation as a judge', async () => {
    mockAuthSession(judgeSession);
    const { POST } = await evaluateModule();

    mockPrisma.evaluation.upsert.mockResolvedValue({
      id: 'eval-1',
      verdict: 'strong',
      comment: 'Good project',
      stage: 0,
    });

    const req = createMockRequest('POST', {
      url: 'http://localhost:3000/api/evaluate',
      body: {
        formDataId: 'fd-1',
        verdict: 'strong',
        comment: 'Good project',
        scoreOverall: 4,
        stage: 0,
      },
    });

    const result = await callHandler(POST, req);
    const data = expectSuccess(result);
    expect(data.verdict).toBe('strong');
    expect(data.comment).toBe('Good project');
  });

  it('creates an evaluation as devrel', async () => {
    mockAuthSession(devrelSession);
    const { POST } = await evaluateModule();

    mockPrisma.evaluation.upsert.mockResolvedValue({
      id: 'eval-2',
      verdict: 'top',
      comment: null,
      stage: 1,
    });

    const req = createMockRequest('POST', {
      url: 'http://localhost:3000/api/evaluate',
      body: { formDataId: 'fd-1', verdict: 'top', stage: 1 },
    });

    const result = await callHandler(POST, req);
    expectSuccess(result);
  });

  it('rejects non-judge/devrel users', async () => {
    mockAuthSession(regularSession);
    const { POST } = await evaluateModule();

    const req = createMockRequest('POST', {
      url: 'http://localhost:3000/api/evaluate',
      body: { formDataId: 'fd-1', verdict: 'strong' },
    });

    const result = await callHandler(POST, req);
    expectError(result, 403, 'FORBIDDEN');
  });

  it('rejects unauthenticated requests', async () => {
    mockAuthSession(null);
    const { POST } = await evaluateModule();

    const req = createMockRequest('POST', {
      url: 'http://localhost:3000/api/evaluate',
      body: { formDataId: 'fd-1', verdict: 'strong' },
    });

    const result = await callHandler(POST, req);
    expectError(result, 401, 'AUTH_REQUIRED');
  });

  it('rejects invalid verdict', async () => {
    mockAuthSession(judgeSession);
    const { POST } = await evaluateModule();

    const req = createMockRequest('POST', {
      url: 'http://localhost:3000/api/evaluate',
      body: { formDataId: 'fd-1', verdict: 'invalid' },
    });

    const result = await callHandler(POST, req);
    expectError(result, 400, 'VALIDATION_ERROR');
  });

  it('rejects invalid scoreOverall (not in 0.5 increments)', async () => {
    mockAuthSession(judgeSession);
    const { POST } = await evaluateModule();

    const req = createMockRequest('POST', {
      url: 'http://localhost:3000/api/evaluate',
      body: {
        formDataId: 'fd-1',
        verdict: 'strong',
        scoreOverall: 3.3,
      },
    });

    const result = await callHandler(POST, req);
    expectError(result, 400, 'VALIDATION_ERROR');
  });

  it('rejects stage out of range', async () => {
    mockAuthSession(judgeSession);
    const { POST } = await evaluateModule();

    const req = createMockRequest('POST', {
      url: 'http://localhost:3000/api/evaluate',
      body: { formDataId: 'fd-1', verdict: 'strong', stage: 5 },
    });

    const result = await callHandler(POST, req);
    expectError(result, 400, 'VALIDATION_ERROR');
  });
});

// ---------------------------------------------------------------------------
// GET /api/evaluate/submissions
// ---------------------------------------------------------------------------

describe('GET /api/evaluate/submissions', () => {
  it('returns submissions for a judge', async () => {
    mockAuthSession(judgeSession);
    const { GET } = await submissionsModule();

    mockPrisma.formData.findMany.mockResolvedValue([]);

    const req = createMockRequest('GET', {
      url: 'http://localhost:3000/api/evaluate/submissions',
    });

    const result = await callHandler(GET, req);
    const data = expectSuccess(result);
    // Route returns the submissions array directly as data (not wrapped in {submissions: []})
    expect(data).toEqual([]);
  });

  it('rejects non-judge users', async () => {
    mockAuthSession(regularSession);
    const { GET } = await submissionsModule();

    const req = createMockRequest('GET', {
      url: 'http://localhost:3000/api/evaluate/submissions',
    });

    const result = await callHandler(GET, req);
    expectError(result, 403, 'FORBIDDEN');
  });
});

// ---------------------------------------------------------------------------
// POST /api/evaluate/advance-stage  -- devrel only
// ---------------------------------------------------------------------------

describe('POST /api/evaluate/advance-stage', () => {
  it('advances stage for devrel user', async () => {
    mockAuthSession(devrelSession);
    const { POST } = await advanceStageModule();

    mockPrisma.formData.updateMany.mockResolvedValue({ count: 2 });

    const req = createMockRequest('POST', {
      url: 'http://localhost:3000/api/evaluate/advance-stage',
      body: { formDataIds: ['fd-1', 'fd-2'], stage: 2 },
    });

    const result = await callHandler(POST, req);
    const data = expectSuccess(result);
    expect(data.updated).toBe(2);
    expect(data.stage).toBe(2);
  });

  it('rejects judge users (devrel only)', async () => {
    mockAuthSession(judgeSession);
    const { POST } = await advanceStageModule();

    const req = createMockRequest('POST', {
      url: 'http://localhost:3000/api/evaluate/advance-stage',
      body: { formDataId: 'fd-1', stage: 1 },
    });

    const result = await callHandler(POST, req);
    expectError(result, 403, 'FORBIDDEN');
  });

  it('rejects missing form data ids', async () => {
    mockAuthSession(devrelSession);
    const { POST } = await advanceStageModule();

    const req = createMockRequest('POST', {
      url: 'http://localhost:3000/api/evaluate/advance-stage',
      body: { stage: 1 },
    });

    const result = await callHandler(POST, req);
    expectError(result, 400, 'VALIDATION_ERROR');
  });
});

// ---------------------------------------------------------------------------
// POST /api/evaluate/final-verdict  -- devrel only
// ---------------------------------------------------------------------------

describe('POST /api/evaluate/final-verdict', () => {
  it('sets final verdict for devrel user', async () => {
    mockAuthSession(devrelSession);
    const { POST } = await finalVerdictModule();

    mockPrisma.formData.update.mockResolvedValue({
      id: 'fd-1',
      final_verdict: 'top',
    });

    const req = createMockRequest('POST', {
      url: 'http://localhost:3000/api/evaluate/final-verdict',
      body: { formDataId: 'fd-1', verdict: 'top' },
    });

    const result = await callHandler(POST, req);
    const data = expectSuccess(result);
    expect(data.finalVerdict).toBe('top');
  });

  it('allows null verdict to clear final verdict', async () => {
    mockAuthSession(devrelSession);
    const { POST } = await finalVerdictModule();

    mockPrisma.formData.update.mockResolvedValue({
      id: 'fd-1',
      final_verdict: null,
    });

    const req = createMockRequest('POST', {
      url: 'http://localhost:3000/api/evaluate/final-verdict',
      body: { formDataId: 'fd-1', verdict: null },
    });

    const result = await callHandler(POST, req);
    const data = expectSuccess(result);
    expect(data.finalVerdict).toBeNull();
  });

  it('rejects non-devrel users', async () => {
    mockAuthSession(judgeSession);
    const { POST } = await finalVerdictModule();

    const req = createMockRequest('POST', {
      url: 'http://localhost:3000/api/evaluate/final-verdict',
      body: { formDataId: 'fd-1', verdict: 'top' },
    });

    const result = await callHandler(POST, req);
    expectError(result, 403, 'FORBIDDEN');
  });

  it('rejects invalid verdict string', async () => {
    mockAuthSession(devrelSession);
    const { POST } = await finalVerdictModule();

    const req = createMockRequest('POST', {
      url: 'http://localhost:3000/api/evaluate/final-verdict',
      body: { formDataId: 'fd-1', verdict: 'invalid' },
    });

    const result = await callHandler(POST, req);
    expectError(result, 400, 'VALIDATION_ERROR');
  });
});

// ---------------------------------------------------------------------------
// Security: evaluate role isolation
// ---------------------------------------------------------------------------

describe('Security: evaluate role isolation', () => {
  it('regular user cannot submit evaluations even with valid payload', async () => {
    mockAuthSession(regularSession);
    const { POST } = await evaluateModule();

    const req = createMockRequest('POST', {
      url: 'http://localhost:3000/api/evaluate',
      body: {
        formDataId: 'fd-1',
        verdict: 'strong',
        comment: 'Trying to sneak in',
        stage: 0,
      },
    });

    const result = await callHandler(POST, req);
    expectError(result, 403, 'FORBIDDEN');
    // Prisma should never be called
    expect(mockPrisma.evaluation.upsert).not.toHaveBeenCalled();
  });

  it('regular user cannot list submissions', async () => {
    mockAuthSession(regularSession);
    const { GET } = await submissionsModule();

    const req = createMockRequest('GET', {
      url: 'http://localhost:3000/api/evaluate/submissions',
    });

    const result = await callHandler(GET, req);
    expectError(result, 403, 'FORBIDDEN');
    expect(mockPrisma.formData.findMany).not.toHaveBeenCalled();
  });

  it('regular user cannot advance stage', async () => {
    mockAuthSession(regularSession);
    const { POST } = await advanceStageModule();

    const req = createMockRequest('POST', {
      url: 'http://localhost:3000/api/evaluate/advance-stage',
      body: { formDataIds: ['fd-1'], stage: 1 },
    });

    const result = await callHandler(POST, req);
    expectError(result, 403, 'FORBIDDEN');
    expect(mockPrisma.formData.updateMany).not.toHaveBeenCalled();
  });

  it('judge cannot set final verdict (devrel-only)', async () => {
    mockAuthSession(judgeSession);
    const { POST } = await finalVerdictModule();

    const req = createMockRequest('POST', {
      url: 'http://localhost:3000/api/evaluate/final-verdict',
      body: { formDataId: 'fd-1', verdict: 'top' },
    });

    const result = await callHandler(POST, req);
    expectError(result, 403, 'FORBIDDEN');
    expect(mockPrisma.formData.update).not.toHaveBeenCalled();
  });
});
