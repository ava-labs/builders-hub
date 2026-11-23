import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { execRaw, count, findFirst, create, order } = vi.hoisted(() => ({
  execRaw: vi.fn(),
  count: vi.fn(),
  findFirst: vi.fn(),
  create: vi.fn(),
  order: [] as string[],
}));

vi.mock('@/prisma/prisma', () => ({
  prisma: {
    $transaction: async (fn: (tx: unknown) => unknown) =>
      fn({
        $executeRaw: (...args: unknown[]) => {
          order.push('lock');
          return execRaw(...args);
        },
        provisionAttempt: {
          count: (...a: unknown[]) => {
            order.push('count');
            return count(...a);
          },
          findFirst,
          create: (...a: unknown[]) => {
            order.push('create');
            return create(...a);
          },
        },
      }),
  },
}));

import { dailyProvisionLimit, reserveDailyProvision } from '@/server/services/provision-quota';

beforeEach(() => {
  [execRaw, count, findFirst, create].forEach((m) => m.mockReset());
  order.length = 0;
  execRaw.mockResolvedValue(1);
  create.mockResolvedValue({ id: 'attempt-1' });
  vi.stubEnv('NODE_ENV', 'production');
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('dailyProvisionLimit', () => {
  it('uses the placeholder defaults when nothing is set', () => {
    vi.stubEnv('QUICK_L1_DAILY_DEPLOYS', '');
    vi.stubEnv('MANAGED_TESTNET_NODES_DAILY_CREATES', '');
    expect(dailyProvisionLimit('quick-l1-deploy')).toBe(10);
    expect(dailyProvisionLimit('managed-testnet-node')).toBe(10);
  });

  it('reads each limit from its own variable, and 0 is a valid limit', () => {
    vi.stubEnv('QUICK_L1_DAILY_DEPLOYS', '3');
    vi.stubEnv('MANAGED_TESTNET_NODES_DAILY_CREATES', '0');
    expect(dailyProvisionLimit('quick-l1-deploy')).toBe(3);
    expect(dailyProvisionLimit('managed-testnet-node')).toBe(0);
  });

  it('falls back to the default on a value that is not a whole number', () => {
    for (const bad of ['abc', '-1', '2.5']) {
      vi.stubEnv('QUICK_L1_DAILY_DEPLOYS', bad);
      expect(dailyProvisionLimit('quick-l1-deploy')).toBe(10);
    }
  });
});

describe('reserveDailyProvision', () => {
  it('takes the per-user lock, then counts, then records the attempt', async () => {
    count.mockResolvedValue(0);
    const result = await reserveDailyProvision('user-1', 'quick-l1-deploy');

    expect(result).toEqual({ allowed: true });
    expect(order).toEqual(['lock', 'count', 'create']);
    expect(JSON.stringify(execRaw.mock.calls)).toMatch(/provision:quick-l1-deploy:user-1/);
    expect(create).toHaveBeenCalledWith({ data: { user_id: 'user-1', kind: 'quick-l1-deploy' } });
  });

  it('counts only this user and kind over the last 24 hours', async () => {
    count.mockResolvedValue(0);
    const before = Date.now();
    await reserveDailyProvision('user-1', 'managed-testnet-node');

    const where = count.mock.calls[0][0].where;
    expect(where.user_id).toBe('user-1');
    expect(where.kind).toBe('managed-testnet-node');
    const since = (where.created_at.gte as Date).getTime();
    expect(before - since).toBeGreaterThanOrEqual(24 * 60 * 60 * 1000 - 1000);
    expect(before - since).toBeLessThanOrEqual(24 * 60 * 60 * 1000 + 1000);
  });

  it('refuses at the cap without recording, and names when a slot frees up', async () => {
    vi.stubEnv('QUICK_L1_DAILY_DEPLOYS', '2');
    count.mockResolvedValue(2);
    const oldest = new Date(Date.now() - 60 * 60 * 1000);
    findFirst.mockResolvedValue({ created_at: oldest });

    const result = await reserveDailyProvision('user-1', 'quick-l1-deploy');

    expect(result.allowed).toBe(false);
    if (result.allowed) return;
    expect(result.limit).toBe(2);
    expect(result.resetAt.getTime()).toBe(oldest.getTime() + 24 * 60 * 60 * 1000);
    expect(result.message).toMatch(/Daily limit reached/);
    expect(result.message).toMatch(/2 Quick L1 deployments/);
    expect(create).not.toHaveBeenCalled();
  });

  it('refuses everything when the limit is 0', async () => {
    vi.stubEnv('MANAGED_TESTNET_NODES_DAILY_CREATES', '0');
    count.mockResolvedValue(0);
    findFirst.mockResolvedValue(null);
    const result = await reserveDailyProvision('user-1', 'managed-testnet-node');
    expect(result.allowed).toBe(false);
    expect(create).not.toHaveBeenCalled();
  });

  it('is not applied in local development, like the burst limit', async () => {
    vi.stubEnv('NODE_ENV', 'development');
    const result = await reserveDailyProvision('dev-user-id', 'quick-l1-deploy');
    expect(result).toEqual({ allowed: true });
    expect(order).toEqual([]);
  });
});
