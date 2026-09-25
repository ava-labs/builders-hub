import { describe, expect, it, vi, beforeEach } from 'vitest';

const { upsertMock, withAuthSpy } = vi.hoisted(() => ({
  upsertMock: vi.fn(),
  withAuthSpy: vi.fn(),
}));

// Stand-in for the real wrapper: records that the route opted into auth, and
// supplies the session the handler is expected to trust.
vi.mock('@/lib/protectedRoute', () => ({
  withAuth:
    (handler: (req: Request, ctx: unknown, session: unknown) => unknown) => {
      withAuthSpy(handler);
      return (req: Request, ctx: unknown, session: unknown) => handler(req, ctx, session);
    },
}));

vi.mock('@/prisma/prisma', () => ({
  prisma: { retro9000ReturningApplication: { upsert: upsertMock } },
}));

import { POST } from '@/app/api/retro9000-returning/route';

beforeEach(() => {
  upsertMock.mockReset();
  upsertMock.mockResolvedValue({ id: 'app-1' });
  // withAuthSpy is intentionally not cleared: it records the wrapper applied at
  // module import, which happens once.
});

function post(body: unknown) {
  return new Request('https://build.avax.network/api/retro9000-returning', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

const session = (email: string | null) => ({ user: { id: 'u1', email } });

describe('POST /api/retro9000-returning', () => {
  it('is wrapped in withAuth', () => {
    expect(withAuthSpy).toHaveBeenCalled();
  });

  // Finding: the upsert key came from the request body, so anyone could
  // overwrite another applicant's submission by naming their address.
  it('ignores a body email and keys the upsert on the session', async () => {
    const res = await (POST as any)(
      post({ email: 'victim@example.com', project_name: 'pwned' }),
      undefined,
      session('attacker@example.com'),
    );

    expect(res.status).toBe(200);
    expect(upsertMock).toHaveBeenCalledTimes(1);
    const args = upsertMock.mock.calls[0][0];
    expect(args.where).toEqual({ email: 'attacker@example.com' });
    expect(args.create.email).toBe('attacker@example.com');
  });

  // Upstream now normalises emails at signup; the upsert key must match that
  // form or one account can end up with two application rows.
  it('normalises the session email before using it as the upsert key', async () => {
    const res = await (POST as any)(
      post({ project_name: 'x' }),
      undefined,
      session('  MixedCase@Example.COM  '),
    );
    expect(res.status).toBe(200);
    expect(upsertMock.mock.calls[0][0].where).toEqual({ email: 'mixedcase@example.com' });
  });

  it('rejects a session with no email rather than writing a blank key', async () => {
    const res = await (POST as any)(post({ project_name: 'x' }), undefined, session(null));
    expect(res.status).toBe(400);
    expect(upsertMock).not.toHaveBeenCalled();
  });

  // Finding variant: the catch block returned the raw Prisma message.
  it('does not leak internal error text', async () => {
    upsertMock.mockRejectedValue(
      new Error('Invalid `prisma.retro9000ReturningApplication.upsert()` — column "bio" ...'),
    );
    const res = await (POST as any)(
      post({ project_name: 'x' }),
      undefined,
      session('user@example.com'),
    );
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.message).toBe('Internal server error');
    expect(JSON.stringify(body)).not.toMatch(/prisma|column/i);
  });
});
