import { describe, expect, it } from 'vitest';

import { filterAcps } from '@/lib/mcp/acps/filter';
import type { AcpEntry } from '@/lib/mcp/acps/parser';

const fixtures: AcpEntry[] = [
  {
    number: 103,
    title: 'Add Dynamic Fees to the P-Chain',
    status: 'Activated',
    rawStatus: 'Activated',
    tracks: ['Standards'],
    authors: ['Dhruba Basu'],
    url: '/docs/acps/103-dynamic-fees',
  },
  {
    number: 13,
    title: 'Subnet-Only Validators',
    status: 'Stale',
    rawStatus: 'Stale',
    tracks: ['Standards'],
    authors: ['Patrick OGrady'],
    supersededBy: [77],
    url: '/docs/acps/13-subnet-only-validators',
  },
  {
    number: 131,
    title: 'Activate Cancun EIPs on C-Chain and Subnet-EVM',
    status: 'Activated',
    rawStatus: 'Activated',
    tracks: ['Standards', 'Subnet'],
    authors: ['Darioush Jalali'],
    url: '/docs/acps/131-cancun-eips',
  },
  {
    number: 108,
    title: 'EVM Event Importing Standard',
    status: 'Proposed',
    rawStatus: 'Proposed',
    tracks: ['Best Practices'],
    authors: ['Michael Kaplan'],
    url: '/docs/acps/108-evm-event-importing',
  },
];

describe('filterAcps', () => {
  it('returns all entries when no filters are provided', () => {
    expect(filterAcps(fixtures)).toHaveLength(4);
  });

  it('filters by status case-insensitively', () => {
    const result = filterAcps(fixtures, { status: 'activated' });
    expect(result.map((e) => e.number).sort((a, b) => a - b)).toEqual([103, 131]);
  });

  it('filters by track using prefix match across combined tracks', () => {
    const standards = filterAcps(fixtures, { track: 'standards' });
    expect(standards.map((e) => e.number).sort((a, b) => a - b)).toEqual([13, 103, 131]);

    const subnet = filterAcps(fixtures, { track: 'subnet' });
    expect(subnet.map((e) => e.number)).toEqual([131]);

    const bestPractices = filterAcps(fixtures, { track: 'Best Practices' });
    expect(bestPractices.map((e) => e.number)).toEqual([108]);
  });

  it('combines status and track filters', () => {
    const result = filterAcps(fixtures, { status: 'Activated', track: 'subnet' });
    expect(result.map((e) => e.number)).toEqual([131]);
  });

  it('respects the limit parameter', () => {
    const result = filterAcps(fixtures, { limit: 2 });
    expect(result).toHaveLength(2);
  });

  it('ignores limit when it is zero or negative', () => {
    expect(filterAcps(fixtures, { limit: 0 })).toHaveLength(4);
    expect(filterAcps(fixtures, { limit: -3 })).toHaveLength(4);
  });

  it('returns an empty array for unknown status', () => {
    expect(filterAcps(fixtures, { status: 'Withdrawn' })).toEqual([]);
  });
});
