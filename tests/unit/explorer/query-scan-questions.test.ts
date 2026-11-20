import { beforeEach, describe, expect, it, vi } from 'vitest';

const runQuery = vi.hoisted(() => vi.fn());

vi.mock('@/lib/redis', () => ({ redis: vi.fn(async () => null) }));
vi.mock('@/lib/explorer-query/clickhouse', () => ({ anchored: vi.fn(async (sql: string) => ({ sql, anchor: null, sources: [] })), runQuery }));
vi.mock('@/lib/explorer-query/enrich', () => ({ nameRows: vi.fn(async () => ({})) }));

import { EXAMPLES, L1_EXAMPLES, NETWORK_EXAMPLES, PCHAIN_EXAMPLES } from '@/lib/explorer-query/examples';
import { scanChain } from '@/lib/explorer-query/scan';

/* A scan runs the page's own suggestions: one query for each suggestion that has a fixed answer. */

const count = (examples: typeof EXAMPLES) => examples.flatMap((g) => g.items).length;

beforeEach(() => {
  runQuery.mockReset().mockResolvedValue({ columns: [], rows: [], rowCount: 0, elapsedMs: 1, rowsRead: 0, bytesRead: 0, truncated: false, ranAt: '' });
});

describe('scanChain', () => {
  it.each([
    ['the C-Chain', 43114, EXAMPLES],
    ['the P-Chain', 1, PCHAIN_EXAMPLES],
    ['the network', 0, NETWORK_EXAMPLES],
    ['an L1', 43419, L1_EXAMPLES],
  ])('runs each suggestion of %s once', async (_name, chainId, examples) => {
    await scanChain(chainId, 'AVAX', 'http://localhost');
    expect(runQuery).toHaveBeenCalledTimes(count(examples));
    expect(runQuery.mock.calls.every((c) => c[1] === chainId)).toBe(true);
  });

  it('runs nothing on Fuji', async () => {
    await scanChain(43113, 'AVAX', 'http://localhost');
    await scanChain(5, 'AVAX', 'http://localhost');
    expect(runQuery).not.toHaveBeenCalled();
  });
});
