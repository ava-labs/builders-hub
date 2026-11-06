import { describe, expect, it } from 'vitest';
import {
  attributeCensus,
  chunk,
  extractPairs,
  pairKey,
  parseScanExport,
  planImport,
  toImportRow,
  userNodeKey,
  type DynamoItem,
  type ImportContext,
} from '@/scripts/notify-migration/map';

// Synthetic data only: example.com addresses and made-up NodeIDs.
const NODE_A = 'NodeID-7Xhw2mDxuDS44j42TCB6U5579esbSt3Lg';
const NODE_B = 'NodeID-MFrZFVCXPv5iCn6M9K6XduxGTYp891xXZ';
const NODE_C = 'NodeID-NFBbbJ4qCmNaCzeW7sxErhvWqvEQMnYcN';

function item(nodeId: string, email: string, extra: Record<string, unknown> = {}): DynamoItem {
  return { NodeID: { S: nodeId }, Email: { S: email }, ...extra } as DynamoItem;
}

function ctx(over: Partial<ImportContext> = {}): ImportContext {
  return {
    existingPairs: new Set(),
    existingUserNodes: new Set(),
    userIdByEmail: new Map(),
    activeNodes: null,
    ...over,
  };
}

describe('parseScanExport', () => {
  it('reads the Items array', () => {
    expect(parseScanExport({ Items: [item(NODE_A, 'user1@example.com')], Count: 1 })).toHaveLength(1);
  });

  it('rejects a file without Items', () => {
    expect(() => parseScanExport({ items: [] })).toThrow(/Items/);
    expect(() => parseScanExport(null)).toThrow(/Items/);
  });

  it('rejects an entry that is not an object', () => {
    expect(() => parseScanExport({ Items: ['x'] })).toThrow(/not an object/);
  });
});

describe('attributeCensus', () => {
  it('counts attribute names, not values', () => {
    const census = attributeCensus([
      item(NODE_A, 'user1@example.com', { Confirmed: { BOOL: true } }),
      item(NODE_B, 'user2@example.com'),
    ]);
    expect(census).toEqual({ NodeID: 2, Email: 2, Confirmed: 1 });
    expect(JSON.stringify(census)).not.toContain('example.com');
  });
});

describe('extractPairs', () => {
  it('normalizes the email and keeps valid pairs in order', () => {
    const { pairs, report } = extractPairs([item(NODE_A, '  User1@Example.COM '), item(NODE_B, 'user2@example.com')]);
    expect(pairs).toEqual([
      { email: 'user1@example.com', node_id: NODE_A },
      { email: 'user2@example.com', node_id: NODE_B },
    ]);
    expect(report).toEqual({ items: 2, invalidNodeId: 0, emailNotPlaintext: 0, duplicatePairs: 0 });
  });

  it('keeps a 32-character NodeID', () => {
    const short = 'NodeID-r8cX652m7iGmBd19UmTQxtb7GHSBNK5p';
    const { pairs, report } = extractPairs([item(short, 'user1@example.com')]);
    expect(pairs).toEqual([{ email: 'user1@example.com', node_id: short }]);
    expect(report.invalidNodeId).toBe(0);
  });

  it('counts invalid NodeIDs with the create route rule', () => {
    const { pairs, report } = extractPairs([
      item('NodeID-short', 'user1@example.com'),
      item('7Xhw2mDxuDS44j42TCB6U5579esbSt3Lg', 'user1@example.com'),
      item('NodeID-0Ohw2mDxuDS44j42TCB6U5579esbSt3Lg', 'user1@example.com'), // 0 and O are not base58
      { Email: { S: 'user1@example.com' } },
    ]);
    expect(pairs).toEqual([]);
    expect(report.invalidNodeId).toBe(4);
  });

  it('counts emails that are not plaintext', () => {
    const { pairs, report } = extractPairs([
      item(NODE_A, 'AQICAHhWZXJ5RmFrZUNpcGhlcnRleHQ9PQ=='), // looks like KMS ciphertext
      { NodeID: { S: NODE_B }, Email: { B: 'AQICAHg=' } } as DynamoItem,
      { NodeID: { S: NODE_C } },
    ]);
    expect(pairs).toEqual([]);
    expect(report.emailNotPlaintext).toBe(3);
  });

  it('dedupes on (email, NodeID) after normalization', () => {
    const { pairs, report } = extractPairs([
      item(NODE_A, 'user1@example.com'),
      item(NODE_A, 'USER1@example.com'),
      item(NODE_B, 'user1@example.com'),
    ]);
    expect(pairs).toHaveLength(2);
    expect(report.duplicatePairs).toBe(1);
  });
});

describe('toImportRow', () => {
  it('uses the Primary Network defaults and the legacy source', () => {
    expect(toImportRow({ email: 'user1@example.com', node_id: NODE_A }, null)).toEqual({
      user_id: null,
      node_id: NODE_A,
      subnet_id: 'primary',
      email: 'user1@example.com',
      source: 'avalanche-notify',
      label: null,
      uptime_alert: true,
      uptime_threshold: 95,
      version_alert: true,
      expiry_alert: true,
      expiry_days: 7,
      balance_alert: false,
      security_alert: false,
      active: true,
    });
  });
});

describe('planImport', () => {
  const pairs = [
    { email: 'user1@example.com', node_id: NODE_A },
    { email: 'user1@example.com', node_id: NODE_B },
    { email: 'user2@example.com', node_id: NODE_C },
  ];

  it('sets user_id when the email has an account, else null', () => {
    const { rows, report } = planImport(pairs, ctx({ userIdByEmail: new Map([['user1@example.com', 'u1']]) }));
    expect(rows.map((r) => r.user_id)).toEqual(['u1', 'u1', null]);
    expect(report).toMatchObject({ rows: 3, rowsWithAccount: 2, rowsWithoutAccount: 1, emails: 2, nodes: 3 });
  });

  it('skips pairs that ValidatorAlert already holds', () => {
    const { rows, report } = planImport(
      pairs,
      ctx({ existingPairs: new Set([pairKey('User1@example.com', NODE_A)]) }),
    );
    expect(rows.map((r) => r.node_id)).toEqual([NODE_B, NODE_C]);
    expect(report.alreadyInValidatorAlert).toBe(1);
  });

  it('skips a node that the account already watches under another address', () => {
    const { rows, report } = planImport(
      pairs,
      ctx({
        userIdByEmail: new Map([['user1@example.com', 'u1']]),
        existingUserNodes: new Set([userNodeKey('u1', NODE_B)]),
      }),
    );
    expect(rows.map((r) => r.node_id)).toEqual([NODE_A, NODE_C]);
    expect(report.alreadyInValidatorAlert).toBe(1);
  });

  it('with activeNodes, skips nodes that no longer validate', () => {
    const { rows, report } = planImport(pairs, ctx({ activeNodes: new Set([NODE_A]) }));
    expect(rows.map((r) => r.node_id)).toEqual([NODE_A]);
    expect(report.notValidating).toBe(2);
  });

  it('a second run over the same export adds nothing', () => {
    const first = planImport(pairs, ctx());
    const existingPairs = new Set(first.rows.map((r) => pairKey(r.email, r.node_id)));
    expect(planImport(pairs, ctx({ existingPairs })).rows).toEqual([]);
  });
});

describe('chunk', () => {
  it('splits a list into batches', () => {
    expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
    expect(chunk([], 500)).toEqual([]);
  });

  it('rejects a size below 1', () => {
    expect(() => chunk([1], 0)).toThrow();
  });
});
