import { beforeEach, describe, expect, it, vi } from 'vitest';

/* The stage form of a project: a confirmed member reads and writes it, and a write never reaches the form row of a
   grant application. */

const db = vi.hoisted(() => ({
  projectFindFirst: vi.fn(),
  formFindFirst: vi.fn(),
  txFormFindFirst: vi.fn(),
}));
vi.mock('@/prisma/prisma', () => ({
  prisma: {
    project: { findFirst: db.projectFindFirst },
    formData: { findFirst: db.formFindFirst },
    $transaction: (run: (tx: unknown) => unknown) =>
      run({ $queryRaw: async () => [], formData: { findFirst: db.txFormFindFirst } }),
  },
}));
vi.mock('@/lib/auth/authSession', () => ({ getAuthSession: async () => ({ user: { id: 'me', email: 'me@example.com' } }) }));

import { GET, POST } from '@/app/api/project/form-data/route';

const EVENT = '11111111-1111-4111-8111-111111111111';
const GRANTS = '00000000-0000-4000-8000-000000000002';
const post = (body: unknown) =>
  POST(new Request('http://localhost/api/project/form-data', { method: 'POST', body: JSON.stringify(body), headers: { 'content-type': 'application/json' } }), {});

beforeEach(() => {
  for (const fn of Object.values(db)) fn.mockReset();
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

describe('POST /api/project/form-data', () => {
  it('finds the project only for a confirmed member', async () => {
    db.projectFindFirst.mockResolvedValue(null);
    expect((await post({ hackathonId: EVENT, projectId: 'p1', stageIndex: 0, values: { a: 'b' } })).status).toBe(404);
    expect(db.projectFindFirst.mock.calls[0][0].where.members).toEqual({ some: { user_id: 'me', status: 'Confirmed' } });

    expect((await post({ hackathonId: EVENT, stageIndex: 0, values: { a: 'b' } })).status).toBe(404);
    expect(db.projectFindFirst.mock.calls[1][0].where.members).toEqual({ some: { user_id: 'me', status: 'Confirmed' } });
  });

  it('never merges into the form row of a grant application', async () => {
    db.projectFindFirst.mockResolvedValue({ id: 'p1', project_name: 'P' });
    db.txFormFindFirst.mockRejectedValue(new Error('stop here'));
    expect((await post({ hackathonId: EVENT, projectId: 'p1', stageIndex: 0, values: { a: 'b' } })).status).toBe(500);
    expect(db.txFormFindFirst.mock.calls[0][0].where).toEqual({ project_id: 'p1', origin: { not: 'grant_minigrant' } });
  });

  it('takes no stage form for the grant program', async () => {
    expect((await post({ hackathonId: GRANTS, projectId: 'p1', stageIndex: 0, values: {} })).status).toBe(400);
    expect(db.projectFindFirst).not.toHaveBeenCalled();
  });

  it('checks the text inside a group of fields', async () => {
    for (const values of [
      { grant: { project_url: 'javascript:alert(1)' } },
      { grant: { links: [{ url: 'data:text/html,x' }] } },
      { grant: { note: '<img src=x onerror=1>' } },
    ]) {
      expect((await post({ hackathonId: EVENT, projectId: 'p1', stageIndex: 0, values })).status).toBe(400);
    }
    expect(db.projectFindFirst).not.toHaveBeenCalled();
  });
});

describe('GET /api/project/form-data', () => {
  it('reads the form only for a confirmed member', async () => {
    db.projectFindFirst.mockResolvedValue(null);
    const res = await GET(new Request('http://localhost/api/project/form-data?projectId=p1'), {});
    expect(res.status).toBe(404);
    expect(db.projectFindFirst.mock.calls[0][0].where.members).toEqual({ some: { user_id: 'me', status: 'Confirmed' } });
    expect(db.formFindFirst).not.toHaveBeenCalled();
  });
});
