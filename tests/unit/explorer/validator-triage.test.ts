import { describe, expect, it } from 'vitest';

import {
  applyFilter,
  buildRows,
  compareRelease,
  cutTo,
  defaultTarget,
  facetCounts,
  facetsFor,
  lagOf,
  linkable,
  missingIds,
  parseQuery,
  PRESETS,
  presetActive,
  readState,
  releaseOf,
  sortRows,
  statusOf,
  targetOptions,
  toCsv,
  toggleOption,
  withStatus,
  writeState,
  type CrawlerFeedRow,
  type RosterFeedRow,
  type TriageRow,
} from '@/lib/validator-triage';

/* NodeIDs from the mainnet set; the numbers are shaped like the two feeds. */
const A = 'NodeID-4pmpS7zznorSbCyDRxnfFriggu8pfz2Kv';
const B = 'NodeID-Dz5xT3a4F73jC6HNHDZ6JsE64SbyNxABw';
const C = 'NodeID-1aA7BtLfTX4SRXaWR8HttP4z2UapE1R9';
const D = 'NodeID-8aB9GpRrWCPbhJfjrHbANrmGmQpJ2Y6jW';

function roster(nodeId: string, over: Partial<RosterFeedRow> = {}): RosterFeedRow {
  return {
    nodeId,
    amountStaked: '2000000000000000',
    amountDelegated: '1000000000000000',
    delegationFee: '2',
    delegatorCount: 3,
    version: 'avalanchego/1.15.0',
    connected: true,
    ...over,
  };
}

function crawled(over: Partial<CrawlerFeedRow> = {}): CrawlerFeedRow {
  return {
    total_stake: 3000000000000000,
    p50_uptime: 99.9,
    days_left: 40,
    miss_rate_14d: 0,
    block_count_14d: 120,
    version: 'avalanchego/1.15.0',
    public_ip: '18.141.177.57:9651',
    ...over,
  };
}

function row(over: Partial<TriageRow> = {}): TriageRow {
  return {
    nodeId: A,
    version: '1.15.0',
    stake: 1000,
    delegators: 0,
    fee: 2,
    uptime: 99.5,
    daysLeft: 40,
    missRate: 0,
    blocks14d: 10,
    online: true,
    ip: null,
    ...over,
  };
}

describe('versions', () => {
  it('reads the release out of a client string', () => {
    expect(releaseOf('avalanchego/1.15.0')).toBe('1.15.0');
    expect(releaseOf('')).toBeNull();
    expect(releaseOf(undefined)).toBeNull();
  });

  it('orders releases numerically, not as text', () => {
    expect(compareRelease('1.15.1', '1.9.0')).toBeGreaterThan(0);
    expect(compareRelease('1.14.2', '1.15.0')).toBeLessThan(0);
    expect(compareRelease('1.15.0', '1.15.0')).toBe(0);
  });

  it('grades a release against the target', () => {
    expect(statusOf('1.15.1', '1.15.0')).toBe('current');
    expect(statusOf('1.14.2', '1.15.0')).toBe('behind');
    expect(statusOf(null, '1.15.0')).toBe('unknown');
    expect(lagOf('1.15.0', '1.15.1')).toBe('near');
    expect(lagOf('1.14.2', '1.15.0')).toBe('near');
    expect(lagOf('1.13.5', '1.15.0')).toBe('far');
  });
});

describe('buildRows', () => {
  it('prefers the crawler version and stake, and keeps the connection flag', () => {
    const rows = buildRows(
      [roster(A, { version: 'avalanchego/1.14.2' }), roster(B, { connected: false })],
      new Map([[A, crawled({ version: 'avalanchego/1.15.1' })]]),
    );
    expect(rows[0]).toMatchObject({ nodeId: A, version: '1.15.1', stake: 3_000_000, online: true, ip: '18.141.177.57:9651', uptime: 99.9 });
    // no crawler row: the roster's own version and stake stand in, health is unknown
    expect(rows[1]).toMatchObject({ nodeId: B, version: '1.15.0', stake: 3_000_000, online: false, uptime: null, ip: null });
  });

  it('treats an empty crawler version as no version', () => {
    const rows = buildRows([roster(A, { version: undefined })], new Map([[A, crawled({ version: '', public_ip: '' })]]));
    expect(rows[0].version).toBeNull();
    expect(rows[0].ip).toBeNull();
  });
});

describe('target', () => {
  const rows = [row({ version: '1.15.1' }), ...Array.from({ length: 199 }, () => row({ version: '1.15.0' }))];

  it('defaults to the newest mandatory release', () => {
    const releases = [
      { version: '1.16.0', mandatory: true },
      { version: '1.15.0', mandatory: true },
    ];
    expect(defaultTarget(rows, releases)).toBe('1.16.0');
  });

  it('without release data, skips a canary release under 1% of nodes', () => {
    expect(defaultTarget(rows, null)).toBe('1.15.0');
  });

  it('keeps the required, latest and active releases when newer ones fill the cap', () => {
    const many = ['1.15.9', '1.15.8', '1.15.7', '1.15.6', '1.15.5', '1.15.4', '1.15.3'].map((v) => row({ version: v }));
    const options = targetOptions(many, [{ version: '1.15.0', mandatory: true }, { version: '1.15.2', mandatory: false }], '1.14.0');
    const versions = options.map((o) => o.version);
    expect(versions).toContain('1.15.0');
    expect(versions).toContain('1.15.2');
    expect(versions).toContain('1.14.0');
    expect(versions).toHaveLength(6);
    expect(versions).toEqual([...versions].sort((a, b) => compareRelease(b, a)));
  });

  it('offers the required and latest releases, and tags a release newer than any published one', () => {
    const options = targetOptions(rows, [
      { version: '1.15.0', mandatory: true },
      { version: '1.14.2', mandatory: false },
    ]);
    expect(options.map((o) => [o.version, o.tag, o.nodes])).toEqual([
      ['1.15.1', 'unreleased', 1],
      ['1.15.0', 'required', 199],
    ]);
  });
});

describe('filtering', () => {
  const base = [
    row({ nodeId: A, version: '1.15.0', stake: 2_000_000, online: true, delegators: 5 }),
    row({ nodeId: B, version: '1.14.2', stake: 300_000, online: true, uptime: 85 }),
    row({ nodeId: C, version: null, stake: 50_000, online: false, uptime: 40, missRate: 60 }),
    row({ nodeId: D, version: '1.15.0', stake: 5_000, online: false, daysLeft: 3 }),
  ];
  const rows = withStatus(base, '1.15.0');
  const facets = facetsFor(rows);
  const none = parseQuery('');

  it('ORs options inside a facet and ANDs the facets', () => {
    const notOnTarget = applyFilter(rows, facets, { status: ['behind', 'unknown'] }, none);
    expect(notOnTarget.map((r) => r.nodeId)).toEqual([B, C]);
    const offlineAndUnknown = applyFilter(rows, facets, { status: ['behind', 'unknown'], online: ['no'] }, none);
    expect(offlineAndUnknown.map((r) => r.nodeId)).toEqual([C]);
  });

  it('counts each option with every other facet applied, but not its own', () => {
    const counts = facetCounts(rows, facets, { online: ['no'] }, none);
    expect(counts.online).toEqual({ yes: 2, no: 2 });
    expect(counts.status).toEqual({ current: 1, behind: 0, unknown: 1 });
    expect(counts.version).toEqual({ '1.15.0': 1, '1.14.2': 0, unknown: 1 });
  });

  it('matches the presets to the triage questions', () => {
    const counts = Object.fromEntries(PRESETS.map((p) => [p.id, applyFilter(rows, facets, p.selection, none).length]));
    expect(counts).toEqual({ 'not-on-target': 2, offline: 2, 'low-uptime': 2, 'missing-blocks': 1, ending: 1 });
    expect(presetActive(PRESETS[0], { status: ['unknown', 'behind'] })).toBe(true);
    expect(presetActive(PRESETS[0], { status: ['unknown', 'behind'], online: ['no'] })).toBe(false);
  });

  it('matches a NodeID anywhere, and a version or IP from its start', () => {
    const withIps = withStatus(
      [row({ nodeId: A, version: '1.15.0', ip: '108.131.140.243:9651' }), row({ nodeId: B, version: '1.14.2', ip: '18.141.177.57:9651' })],
      '1.15.0',
    );
    const f = facetsFor(withIps);
    // "1.14" is in 108.131.140.243, but that is not a version match
    expect(applyFilter(withIps, f, {}, parseQuery('1.14')).map((r) => r.nodeId)).toEqual([B]);
    expect(applyFilter(withIps, f, {}, parseQuery('v1.15')).map((r) => r.nodeId)).toEqual([A]);
    expect(applyFilter(withIps, f, {}, parseQuery('avalanchego/1.14.2')).map((r) => r.nodeId)).toEqual([B]);
    expect(applyFilter(withIps, f, {}, parseQuery('108.131')).map((r) => r.nodeId)).toEqual([A]);
    expect(applyFilter(withIps, f, {}, parseQuery('dz5xt3')).map((r) => r.nodeId)).toEqual([B]);
  });

  it('searches one pasted NodeID as that ID, whatever surrounds it', () => {
    for (const raw of [`${B}.`, `"${B}"`, `https://build.avax.network/explorer/mainnet/p-chain/node/${B}`]) {
      expect(applyFilter(rows, facets, {}, parseQuery(raw)).map((r) => r.nodeId)).toEqual([B]);
    }
  });

  it('puts an exact 5% and an exact 50% miss rate in the buckets that start there', () => {
    const edge = withStatus([row({ nodeId: A, missRate: 5 }), row({ nodeId: B, missRate: 50 }), row({ nodeId: C, missRate: 4.99 })], '1.15.0');
    const f = facetsFor(edge);
    const missing = PRESETS.find((p) => p.id === 'missing-blocks')!;
    expect(applyFilter(edge, f, missing.selection, parseQuery('')).map((r) => r.nodeId)).toEqual([A, B]);
    expect(facetCounts(edge, f, {}, parseQuery('')).miss).toMatchObject({ '1-5': 1, '5-10': 1, '50': 1 });
  });

  it('cuts the roster to a pasted list of NodeIDs, even with the separators lost', () => {
    const q = parseQuery(`${A}${C}NodeID-2222222222222222222222222222222`);
    expect(q.ids).toEqual([A, C, 'NodeID-2222222222222222222222222222222']);
    expect(applyFilter(rows, facets, {}, q).map((r) => r.nodeId)).toEqual([A, C]);
    expect(missingIds(rows, q)).toEqual(['NodeID-2222222222222222222222222222222']);
  });

  it('toggles an option, and cuts or uncuts a facet', () => {
    expect(toggleOption({}, 'stake', '1m')).toEqual({ stake: ['1m'] });
    expect(toggleOption({ stake: ['1m'] }, 'stake', '1m')).toEqual({ stake: undefined });
    expect(cutTo({ online: ['no'] }, 'status', ['unknown'])).toEqual({ online: ['no'], status: ['unknown'] });
    expect(cutTo({ status: ['unknown'] }, 'status', ['unknown'])).toEqual({ status: undefined });
  });
});

describe('sorting', () => {
  it('puts a missing value last in either direction', () => {
    const rows = [row({ nodeId: A, uptime: 90 }), row({ nodeId: B, uptime: null }), row({ nodeId: C, uptime: 99 })];
    expect(sortRows(rows, { key: 'uptime', dir: -1 }).map((r) => r.nodeId)).toEqual([C, A, B]);
    expect(sortRows(rows, { key: 'uptime', dir: 1 }).map((r) => r.nodeId)).toEqual([A, C, B]);
  });
});

describe('URL state', () => {
  it('round-trips a triage view and keeps unrelated params', () => {
    const state = {
      target: '1.15.1',
      q: 'NodeID-abc',
      selection: { status: ['behind', 'unknown'], stake: ['1m'] },
      sort: { key: 'uptime' as const, dir: 1 as const },
    };
    const params = writeState(new URLSearchParams('ref=x&status=current'), state);
    expect(params.get('ref')).toBe('x');
    expect(params.get('status')).toBe('behind,unknown');
    expect(readState(params)).toEqual(state);
  });

  it('carries a pasted NodeID list as nodes=, without the prefixes', () => {
    const q = [A, B, C].join(' ');
    const params = writeState(new URLSearchParams(), { target: null, q, selection: {}, sort: { key: 'stake', dir: -1 } });
    expect(params.get('q')).toBeNull();
    expect(params.get('nodes')).toBe([A, B, C].map((id) => id.slice('NodeID-'.length)).join(','));
    expect(parseQuery(readState(params).q).ids).toEqual([A, B, C]);
  });

  it('leaves a list too long for a link out of the URL, and says so', () => {
    const B58 = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
    const many = Array.from({ length: 400 }, (_, i) => `NodeID-${B58[i % 58]}${B58[Math.floor(i / 58)]}${'A'.repeat(31)}`).join(' ');
    expect(parseQuery(many).ids).toHaveLength(400);
    expect(linkable(many)).toBe(false);
    expect(writeState(new URLSearchParams(), { target: null, q: many, selection: {}, sort: { key: 'stake', dir: -1 } }).get('nodes')).toBeNull();
    expect(linkable([A, B].join(' '))).toBe(true);
  });

  it('drops malformed values and leaves the defaults out of the URL', () => {
    const state = readState(new URLSearchParams('target=latest&sort=nope&status=<b>,behind'));
    expect(state.target).toBeNull();
    expect(state.sort).toEqual({ key: 'stake', dir: -1 });
    expect(state.selection).toEqual({ status: ['behind'] });
    expect(writeState(new URLSearchParams(), { target: null, q: '', selection: {}, sort: { key: 'stake', dir: -1 } }).toString()).toBe('');
  });
});

describe('toCsv', () => {
  it('writes one line per validator with the status against the target', () => {
    const rows = withStatus([row({ nodeId: A, version: null, online: false, ip: '1.2.3.4:9651', uptime: 12.3456 })], '1.15.0');
    const [head, line] = toCsv(rows, '1.15.0').trim().split('\n');
    expect(head).toBe(
      'node_id,version,status_vs_1.15.0,online,total_stake_avax,delegators,delegation_fee_pct,uptime_pct,days_left,miss_rate_14d_pct,public_ip',
    );
    expect(line).toBe(`${A},,unknown,no,1000,0,2,12.35,40,0,1.2.3.4:9651`);
  });
});
