import { describe, expect, it, vi, beforeEach } from 'vitest';

const { execRaw, count, findFirst, findUnique, create, order } = vi.hoisted(() => ({
  execRaw: vi.fn(),
  count: vi.fn(),
  findFirst: vi.fn(),
  findUnique: vi.fn(),
  create: vi.fn(),
  order: [] as string[],
}));

vi.mock('@/prisma/prisma', () => ({
  prisma: {
    $transaction: async (fn: (tx: unknown) => unknown) =>
      fn({
        $executeRaw: (...args: unknown[]) => { order.push('lock'); return execRaw(...args); },
        faucetClaim: {
          count: (...a: unknown[]) => { order.push('count'); return count(...a); },
          findFirst,
          create: (...a: unknown[]) => { order.push('create'); return create(...a); },
        },
        user: { findUnique },
      }),
  },
}));

import { checkAndReserveFaucetClaim } from '@/lib/faucet/rateLimit';

beforeEach(() => {
  [execRaw, count, findFirst, findUnique, create].forEach((m) => m.mockReset());
  order.length = 0;
  execRaw.mockResolvedValue(1);
  findUnique.mockResolvedValue({ id: 'user-1' });
  create.mockResolvedValue({ id: 'claim-1' });
});

describe('faucet claim reservation locking', () => {
  // Finding: count-then-insert ran at READ COMMITTED with no lock and no
  // unique constraint, so concurrent requests all passed the same check.
  it('takes the advisory locks BEFORE reading any count', async () => {
    count.mockResolvedValue(0);
    await checkAndReserveFaucetClaim('user-1', 'devnet', '0xAbC', '2', '43117');

    const firstCount = order.indexOf('count');
    const lastLock = order.lastIndexOf('lock');
    expect(lastLock).toBeGreaterThanOrEqual(0);
    expect(firstCount).toBeGreaterThan(lastLock);
  });

  it('locks on both the user and the destination address', async () => {
    count.mockResolvedValue(0);
    await checkAndReserveFaucetClaim('user-1', 'devnet', '0xAbC', '2', '43117');

    const locked = execRaw.mock.calls.map((c) => JSON.stringify(c)).join(' ');
    expect(locked).toMatch(/faucet:user:user-1/);
    expect(locked).toMatch(/faucet:addr:0xabc/);
  });

  it('holds the lock across the whole check-then-insert', async () => {
    count.mockResolvedValue(0);
    await checkAndReserveFaucetClaim('user-1', 'devnet', '0xAbC', '2', '43117');
    // lock ... count ... create, all inside one transaction callback.
    expect(order.indexOf('lock')).toBeLessThan(order.indexOf('count'));
    expect(order.indexOf('count')).toBeLessThan(order.indexOf('create'));
  });

  it('still refuses a claim that is over the limit', async () => {
    count.mockResolvedValue(1);
    findFirst.mockResolvedValue({ created_at: new Date() });
    const r = await checkAndReserveFaucetClaim('user-1', 'devnet', '0xAbC', '2', '43117');
    expect(r.allowed).toBe(false);
    expect(create).not.toHaveBeenCalled();
  });
});
