import { describe, expect, it, vi, beforeEach } from 'vitest';

// In-memory stand-in for the idb object stores. Persists across
// vi.resetModules() (the mock factory closes over it), reset in beforeEach.
const stores = new Map<string, Map<string, unknown>>();

function store(name: string) {
  if (!stores.has(name)) stores.set(name, new Map());
  return stores.get(name)!;
}

vi.mock('idb', () => ({
  openDB: vi.fn(async () => ({
    getAllKeys: async (name: string) => [...store(name).keys()],
    getAll: async (name: string) => [...store(name).values()],
    get: async (name: string, key: string) => store(name).get(key),
    put: async (name: string, value: unknown, key: string) => {
      store(name).set(key, value);
    },
    delete: async (name: string, key: string) => {
      store(name).delete(key);
    },
  })),
}));

// Simulated auth backend: flipping `authed` is the "user logged in through
// the modal without a page load" moment — same JS module state survives.
const auth = { authed: false, serverRows: [] as Array<Record<string, unknown>> };

const fetchMock = vi.fn(async (input: string | URL, init?: RequestInit) => {
  const method = init?.method ?? 'GET';
  if (!auth.authed) return new Response(null, { status: 401 });
  if (method === 'GET') return Response.json({ responses: auth.serverRows });
  return Response.json({ ok: true });
});

const row = (over: Record<string, unknown> = {}) => ({
  selectedAnswers: [1],
  isAnswerChecked: true,
  isCorrect: true,
  attemptCount: 1,
  lastAttemptAt: 1754500000000,
  ...over,
});

async function freshModule() {
  vi.resetModules();
  return import('@/utils/quizzes/indexedDB');
}

beforeEach(() => {
  stores.clear();
  fetchMock.mockClear();
  auth.authed = false;
  auth.serverRows = [];
  vi.stubGlobal('window', {});
  vi.stubGlobal('fetch', fetchMock);
});

const putCalls = () =>
  fetchMock.mock.calls.filter(([, init]) => init?.method === 'PUT');
const postCalls = () =>
  fetchMock.mock.calls.filter(([, init]) => init?.method === 'POST');
const getCalls = () =>
  fetchMock.mock.calls.filter(([, init]) => (init?.method ?? 'GET') === 'GET');

describe('resyncQuizProgress — login without a page load (#4357 armin repro)', () => {
  it('pulls the account rows that the signed-out first sync could not see', async () => {
    const mod = await freshModule();

    // Signed out: first read caches the 401 (this is browser B pre-login)
    expect(await mod.getQuizResponse('q1')).toBeUndefined();

    // User logs in through the modal — no reload, module state unchanged
    auth.authed = true;
    auth.serverRows = [{ quizId: 'q1', ...row() }];

    // Without resync the stale one-shot sync keeps answers invisible
    expect(await mod.getQuizResponse('q1')).toBeUndefined();

    await mod.resyncQuizProgress();
    expect(await mod.getQuizResponse('q1')).toMatchObject({ isCorrect: true });
  });

  it('resumes pushing saves that the cached signed-out state was skipping', async () => {
    const mod = await freshModule();

    await mod.getQuizResponse('q1'); // caches serverHasAccount = false
    await mod.saveQuizResponse('q1', row());
    expect(putCalls()).toHaveLength(0); // signed-out: push correctly skipped

    auth.authed = true;
    await mod.resyncQuizProgress();

    await mod.saveQuizResponse('q2', row());
    expect(putCalls()).toHaveLength(1); // post-login saves reach the API again
  });

  it('backfills rows that were answered between the 401 and the login', async () => {
    const mod = await freshModule();

    await mod.getQuizResponse('q1');
    await mod.saveQuizResponse('q1', row()); // saved locally, push skipped

    auth.authed = true;
    await mod.resyncQuizProgress();

    const bodies = postCalls().map(([, init]) => JSON.parse(init!.body as string));
    expect(bodies).toHaveLength(1);
    expect(bodies[0].map((r: { quizId: string }) => r.quizId)).toContain('q1');
  });

  it('deduplicates concurrent resync calls into a single sync pass', async () => {
    const mod = await freshModule();
    auth.authed = true;

    await Promise.all([mod.resyncQuizProgress(), mod.resyncQuizProgress()]);
    expect(getCalls()).toHaveLength(1);
  });

  it('stays quiet when the user is still signed out after a resync', async () => {
    const mod = await freshModule();

    await mod.resyncQuizProgress(); // e.g. a session event fired while logged out
    await mod.saveQuizResponse('q1', row());
    expect(putCalls()).toHaveLength(0); // the resync's 401 re-arms the skip
    expect(postCalls()).toHaveLength(0); // and no backfill was attempted
  });
});
