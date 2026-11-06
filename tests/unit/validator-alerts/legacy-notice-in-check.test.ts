import { beforeEach, describe, expect, it, vi } from 'vitest';

// Synthetic data only: example.com addresses and made-up ids.
const db = vi.hoisted(() => ({
  rows: [] as { id: string; email: string; node_id: string; alert_logs: { id: string }[] }[],
  logs: [] as { validator_alert_id: string; alert_type: string }[],
  locked: true,
}));
const mail = vi.hoisted(() => ({ sendMail: vi.fn() }));

vi.mock('@/prisma/prisma', () => {
  const client = {
    validatorAlert: { findMany: vi.fn(async () => db.rows) },
    validatorAlertLog: {
      createMany: vi.fn(async ({ data }: { data: { validator_alert_id: string; alert_type: string }[] }) => {
        db.logs.push(...data);
        return { count: data.length };
      }),
    },
    $queryRaw: vi.fn(async () => [{ locked: db.locked }]),
  };
  return { prisma: { ...client, $transaction: vi.fn(async (fn: (tx: typeof client) => unknown) => fn(client)) } };
});
vi.mock('@/server/services/mail', () => mail);

import { NOTICES_PER_RUN, sendPendingLegacyNotices } from '@/server/services/legacy-notice';

const NODE = 'NodeID-7Xhw2mDxuDS44j42TCB6U5579esbSt3Lg';
const row = (id: string, email: string, noticed = false) => ({
  id,
  email,
  node_id: NODE,
  alert_logs: noticed ? [{ id: `log-${id}` }] : [],
});

describe('sendPendingLegacyNotices', () => {
  beforeEach(() => {
    db.rows = [];
    db.logs = [];
    db.locked = true;
    mail.sendMail.mockReset();
    mail.sendMail.mockResolvedValue(undefined);
  });

  it('sends one notice per address, logs it, and holds back alerts sent this run', async () => {
    db.rows = [row('a1', 'user1@example.com'), row('a2', 'user1@example.com'), row('a3', 'user2@example.com', true)];
    const result = await sendPendingLegacyNotices();
    expect(result.sent).toBe(1);
    expect(mail.sendMail).toHaveBeenCalledTimes(1);
    expect(db.logs.map((l) => l.validator_alert_id)).toEqual(['a1', 'a2']);
    // a1 and a2 wait for the next run; a3 had its notice earlier and is checked now.
    expect([...result.withoutNotice].sort()).toEqual(['a1', 'a2']);
  });

  it('keeps a failed send pending and writes no log for it', async () => {
    db.rows = [row('a1', 'user1@example.com')];
    mail.sendMail.mockRejectedValueOnce(new Error('timeout'));
    const result = await sendPendingLegacyNotices();
    expect(result).toMatchObject({ sent: 0, failed: 1 });
    expect(db.logs).toEqual([]);
    expect(result.withoutNotice.has('a1')).toBe(true);
  });

  it(`sends at most ${NOTICES_PER_RUN} per run and holds back the rest`, async () => {
    db.rows = Array.from({ length: NOTICES_PER_RUN + 5 }, (_, i) => row(`a${i}`, `user${i}@example.com`));
    const result = await sendPendingLegacyNotices();
    expect(result.sent).toBe(NOTICES_PER_RUN);
    expect(result.withoutNotice.size).toBe(NOTICES_PER_RUN + 5);
  });

  it('sends nothing when another run holds the lock, and still holds back alerts without a notice', async () => {
    db.rows = [row('a1', 'user1@example.com')];
    db.locked = false;
    const result = await sendPendingLegacyNotices();
    expect(result).toMatchObject({ sent: 0, failed: 0 });
    expect(mail.sendMail).not.toHaveBeenCalled();
    expect(result.withoutNotice.has('a1')).toBe(true);
  });
});
