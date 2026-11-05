import { describe, expect, it } from 'vitest';
import { groupNotices } from '@/scripts/notify-migration/map';
import { legacyNotifyNoticeTemplate } from '@/server/templates/validator-alerts';
import { generateUnsubscribeToken } from '@/server/services/unsubscribe-token';

const NODE_A = 'NodeID-7Xhw2mDxuDS44j42TCB6U5579esbSt3Lg';
const NODE_B = 'NodeID-MFrZFVCXPv5iCn6M9K6XduxGTYp891xXZ';

describe('groupNotices', () => {
  it('makes one notice per address with all of its alerts', () => {
    const { groups, alreadyNoticed } = groupNotices([
      { id: 'a1', email: 'user1@example.com', node_id: NODE_A, noticed: false },
      { id: 'a2', email: 'user2@example.com', node_id: NODE_A, noticed: false },
      { id: 'a3', email: 'User1@example.com', node_id: NODE_B, noticed: false },
    ]);
    expect(alreadyNoticed).toBe(0);
    expect(groups).toEqual([
      {
        email: 'user1@example.com',
        alerts: [
          { alertId: 'a1', nodeId: NODE_A },
          { alertId: 'a3', nodeId: NODE_B },
        ],
      },
      { email: 'user2@example.com', alerts: [{ alertId: 'a2', nodeId: NODE_A }] },
    ]);
  });

  it('skips an address that has a notice on any row', () => {
    const { groups, alreadyNoticed } = groupNotices([
      { id: 'a1', email: 'user1@example.com', node_id: NODE_A, noticed: true },
      { id: 'a3', email: 'user1@example.com', node_id: NODE_B, noticed: false },
    ]);
    expect(groups).toEqual([]);
    expect(alreadyNoticed).toBe(1);
  });
});

describe('legacyNotifyNoticeTemplate', () => {
  const notice = legacyNotifyNoticeTemplate({
    alerts: [
      { alertId: 'a1', nodeId: NODE_A },
      { alertId: 'a3', nodeId: NODE_B },
    ],
    endDate: new Date('2026-11-30T00:00:00Z'),
  });

  it('lists every NodeID with its own signed unsubscribe link', () => {
    for (const [id, node] of [['a1', NODE_A], ['a3', NODE_B]]) {
      expect(notice.html).toContain(node);
      expect(notice.text).toContain(node);
      const link = `unsubscribe?id=${id}&token=${generateUnsubscribeToken(id)}`;
      expect(notice.html).toContain(link);
      expect(notice.text).toContain(link);
    }
  });

  it('gives the end date and the dashboard link', () => {
    expect(notice.html).toContain('November 30, 2026');
    expect(notice.text).toContain('November 30, 2026');
    expect(notice.html).toContain('https://build.avax.network/validator-alerts');
    expect(notice.text).toContain('https://build.avax.network/validator-alerts');
    expect(notice.html).toContain('these 2 validators');
  });

  it('has no em dash', () => {
    expect(`${notice.subject}${notice.html}${notice.text}`).not.toContain('\u2014');
  });
});
