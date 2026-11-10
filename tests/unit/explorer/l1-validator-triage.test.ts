import { describe, expect, it } from 'vitest';

import {
  L1_PRESETS,
  buildL1Rows,
  l1FacetsFor,
  l1Finder,
  readL1State,
  seenText,
  sortL1Rows,
  summarizeL1s,
  toL1Csv,
  writeL1State,
  type L1FeedRow,
  type L1Info,
  type L1StatusRow,
} from '@/lib/l1-validator-triage';
import { filterRows, optionCounts, parseQuery, presetActive, withStatus } from '@/lib/validator-triage';

/* Made-up IDs: three L1s, one node on two of them. */
const NOW = 1_790_000_000;
const DAY = 86_400;
const PRICE = 512; // nAVAX per second, the fee's floor
const A = 'NodeID-AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';
const B = 'NodeID-BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB';
const C = 'NodeID-CCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC';
const D = 'NodeID-DDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDD';
const BIG = 'SubnetBigBigBigBigBigBigBigBigBigBigBigBigBigBig1';
const SOLO = 'SubnetSoloSoloSoloSoloSoloSoloSoloSoloSoloSolo11';
const SHUT = 'SubnetShutShutShutShutShutShutShutShutShutShut11';

const INFO: Record<string, L1Info> = {
  [BIG]: { name: 'Bigchain', slug: 'bigchain', logo: 'https://example.com/big.png' },
  [SOLO]: { name: 'Solo', slug: 'solo' },
  [SHUT]: { name: 'Shut', slug: 'shut', isPrivate: true },
};

/** a validation with a balance of `days` at the fee's floor */
function feed(nodeId: string, subnetId: string, over: Partial<L1FeedRow> & { days?: number } = {}): L1FeedRow {
  const { days = 60, ...rest } = over;
  return {
    nodeId,
    validationId: `${nodeId.slice(7, 12)}-${subnetId.slice(6, 10)}`,
    subnetId,
    weight: 100,
    balance: days * PRICE * DAY,
    createdAt: NOW - 90 * DAY,
    version: '1.15.1',
    seenAt: NOW - 3600,
    ip: '203.0.113.7:9651',
    ...rest,
  };
}

const FEED: L1FeedRow[] = [
  feed(A, BIG, { weight: 300 }),
  feed(B, BIG, { weight: 100, version: '1.14.1', days: 5, seenAt: NOW - 40 * DAY }),
  feed(C, BIG, { weight: 100, version: null, seenAt: null, ip: null }),
  feed(A, SOLO, { weight: 7, version: '1.14.1', days: 20 }),
  feed(D, SHUT, { version: null, seenAt: null, ip: null, days: 400 }),
];

function rowsAt(target = '1.15.0', price: number | null = PRICE): L1StatusRow[] {
  return withStatus(buildL1Rows(FEED, (id) => INFO[id], price, NOW), target);
}

describe('buildL1Rows', () => {
  it('weighs each validator inside its own L1 and names the L1 once', () => {
    let asked = 0;
    const rows = buildL1Rows(FEED, (id) => (asked++, INFO[id]), PRICE, NOW);
    expect(asked).toBe(3);
    const [a, b] = rows;
    expect(a.share).toBeCloseTo(60);
    expect(b.share).toBeCloseTo(20);
    expect(rows[3].share).toBe(100);
    expect(a.l1Size).toBe(3);
    expect(a.l1).toBe('Bigchain');
    expect(rows[4].isPrivate).toBe(true);
  });

  it('turns a balance into AVAX and days at the fee, and a handshake into its age', () => {
    const [a, b, c] = buildL1Rows(FEED, (id) => INFO[id], PRICE, NOW);
    expect(a.balance).toBeCloseTo((60 * PRICE * DAY) / 1e9);
    expect(a.daysLeft).toBeCloseTo(60);
    expect(b.daysLeft).toBeCloseTo(5);
    expect(a.seenDays).toBeCloseTo(1 / 24);
    expect(b.seenDays).toBeCloseTo(40);
    expect(c.seenDays).toBeNull();
  });

  it('leaves the days unknown while the fee is unknown', () => {
    expect(buildL1Rows(FEED, (id) => INFO[id], null, NOW).every((r) => r.daysLeft === null)).toBe(true);
  });

  it('writes a handshake age in hours, then days', () => {
    expect(seenText(0.01)).toBe('1h ago');
    expect(seenText(0.5)).toBe('12h ago');
    expect(seenText(3.9)).toBe('3d ago');
  });
});

describe('facets and presets', () => {
  const rows = rowsAt();
  const facets = l1FacetsFor(rows);
  const all = () => true;

  it('lists the L1s the biggest first', () => {
    expect(facets.find((f) => f.key === 'l1')!.options.map((o) => o.label)).toEqual(['Bigchain', 'Shut', 'Solo']);
  });

  it('buckets the balance, the share and the handshake', () => {
    const counts = optionCounts(rows, facets, {}, all);
    expect(counts.runway).toEqual({ lt7: 1, '7-30': 1, '30-90': 2, '90-365': 0, '365': 1 });
    // B and C hold exactly 20% of Bigchain: a bucket holds its lower edge
    expect(counts.share).toEqual({ '50': 3, '20-50': 2, '5-20': 0, lt5: 0 });
    expect(counts.seen).toEqual({ lt1: 2, '1-7': 0, '7-30': 0, '30': 1, never: 2 });
    expect(counts.status).toEqual({ current: 1, behind: 2, unknown: 2 });
  });

  it('answers the triage presets', () => {
    const n = (id: string) => filterRows(rows, facets, L1_PRESETS.find((p) => p.id === id)!.selection, all).length;
    expect(n('not-on-target')).toBe(4);
    // B holds 20% of Bigchain, A all of Solo: both behind with weight
    expect(n('behind-heavy')).toBe(2);
    expect(n('runs-out')).toBe(1);
    expect(n('unseen')).toBe(3);
    expect(presetActive(L1_PRESETS[0], { status: ['unknown', 'behind'] })).toBe(true);
  });
});

describe('search', () => {
  const rows = rowsAt();
  const find = (q: string) => rows.filter(l1Finder(parseQuery(q))).map((r) => `${r.nodeId.slice(7, 8)}@${r.l1}`);

  it('finds an L1 by any part of its name, and a version from its start', () => {
    expect(find('bigch')).toEqual(['A@Bigchain', 'B@Bigchain', 'C@Bigchain']);
    expect(find('v1.14')).toEqual(['B@Bigchain', 'A@Solo']);
  });

  it('cuts to a pasted NodeID list, every seat of each node', () => {
    expect(find(`${A}\n${D}`)).toEqual(['A@Bigchain', 'A@Solo', 'D@Shut']);
  });
});

describe('sortL1Rows', () => {
  const rows = rowsAt();
  const order = (key: 'l1' | 'balance' | 'seen', dir: 1 | -1 = -1) => sortL1Rows(rows, { key, dir }).map((r) => `${r.nodeId.slice(7, 8)}@${r.l1}`);

  it('opens by L1, the biggest first, its heaviest validator first', () => {
    expect(order('l1')).toEqual(['A@Bigchain', 'B@Bigchain', 'C@Bigchain', 'D@Shut', 'A@Solo']);
  });

  it('puts a missing value last either way', () => {
    expect(order('seen').slice(-2)).toEqual(['C@Bigchain', 'D@Shut']);
    expect(order('seen', 1).slice(-2)).toEqual(['C@Bigchain', 'D@Shut']);
    expect(order('balance', 1)[0]).toBe('B@Bigchain');
  });
});

describe('URL state', () => {
  it('round-trips a view with an L1 cut by its subnet ID', () => {
    const state = { target: '1.15.1', q: 'bigch', selection: { l1: [BIG], status: ['behind'] }, sort: { key: 'balance' as const, dir: 1 as const } };
    const params = writeL1State(new URLSearchParams('ref=x'), state);
    expect(params.get('l1')).toBe(BIG);
    expect(params.get('ref')).toBe('x');
    expect(readL1State(params)).toEqual(state);
  });

  it('leaves the opening sort out, and drops what it cannot read', () => {
    expect(writeL1State(new URLSearchParams(), { target: null, q: '', selection: {}, sort: { key: 'l1', dir: -1 } }).toString()).toBe('');
    expect(readL1State(new URLSearchParams('sort=stake&runway=<x>,lt7')).selection).toEqual({ runway: ['lt7'] });
    expect(readL1State(new URLSearchParams('sort=stake')).sort).toEqual({ key: 'l1', dir: -1 });
  });
});

describe('summarizeL1s', () => {
  it('puts the L1 with the most weight behind first, and does not count a private L1 dark', () => {
    const s = summarizeL1s(rowsAt());
    expect(s.map((x) => x.name)).toEqual(['Solo', 'Bigchain', 'Shut']);
    const big = s[1];
    expect(big.behind).toBe(1);
    expect(big.unknown).toBe(1);
    expect(big.weightOn).toBeCloseTo(60);
    expect(big.weightBehind).toBeCloseTo(20);
    expect(big.soonest).toBeCloseTo(5);
    expect(big.versions).toEqual([
      { version: '1.15.1', n: 1 },
      { version: '1.14.1', n: 1 },
      { version: 'unknown', n: 1 },
    ]);
  });
});

describe('toL1Csv', () => {
  it('writes one line per validation with the status against the target', () => {
    const [head, line] = toL1Csv(rowsAt().slice(1, 2), '1.15.0').trim().split('\n');
    expect(head).toBe(
      'node_id,validation_id,l1,subnet_id,version,status_vs_1.15.0,last_handshake_days_ago,weight,weight_share_pct,balance_avax,days_left,registered,public_ip',
    );
    expect(line).toBe(`${B},BBBBB-BigB,Bigchain,${BIG},1.14.1,behind,40,100,20,0.2212,5,2026-06-23,203.0.113.7:9651`);
  });
});
