import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/clickhouse/client', () => ({ withQuerySlot: vi.fn(async (run: () => unknown) => run()) }));

import { runQuery, scanLimit } from '@/lib/explorer-query/clickhouse';

// ClickHouse's words for a read past max_rows_to_read, as stats-api's /v2/query passes them on
const OVER = "clickhouse: code: 158, message: Limit for rows (controlled by 'max_rows_to_read' setting) exceeded, max rows: 1.20 billion, current rows: 1.59 billion";

beforeEach(() => {
  vi.stubEnv('STATS_QUERY_KEY', 'test');
  vi.stubEnv('QUERY_CLICKHOUSE_URL', '');
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe('a read past the rows cap', () => {
  it('is told apart from other errors, with the counts ClickHouse gives', () => {
    expect(scanLimit(OVER)?.message).toBe('This question scans too much of the chain: about 1.6 billion rows, and one question may read 1.2 billion. Narrow the time range or add a filter.');
    // older versions name the cap by its words, and may give plain numbers
    expect(scanLimit('Limit for rows to read exceeded, max rows: 1200000000, current rows: 1592272470')?.message).toBe(
      'This question scans too much of the chain: about 1.6 billion rows, and one question may read 1.2 billion. Narrow the time range or add a filter.',
    );
    expect(scanLimit("Limit for (uncompressed) bytes (controlled by 'max_bytes_to_read' setting) exceeded, max bytes: 100.00 GB, current bytes: 150.00 GB")?.message).toBe(
      'This question scans too much of the chain. Narrow the time range or add a filter.',
    );
    // a read ClickHouse expects to run past the timeout stops early, with the rows it would process
    expect(scanLimit('Estimated query execution time (120.52345 seconds) is too long. Maximum: 45. Estimated rows to process: 1592500817 (26214400 read in 10.00012 seconds)')?.message).toBe(
      'This question scans too much of the chain: about 1.6 billion rows. Narrow the time range or add a filter.',
    );
    // a result past max_result_rows, and any other error, is no scan
    expect(scanLimit('Limit for result exceeded, max rows: 2.00 thousand, current rows: 8.19 thousand (TOO_MANY_ROWS_OR_BYTES)')).toBeNull();
    expect(scanLimit('Timeout exceeded: elapsed 45.0 seconds, maximum: 45 (TIMEOUT_EXCEEDED)')).toBeNull();
  });

  it('comes out of runQuery as the refusal, from the error stats-api sends', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ message: OVER, error: 'Bad Request', statusCode: 400 }), { status: 400 })));
    const e = await runQuery("SELECT count() AS n FROM raw_txs WHERE chain_id = 43114 AND block_time >= '2020-01-01'").catch((x: unknown) => x);
    expect(e).toBeInstanceOf(Error);
    expect((e as Error).name).toBe('ScanLimitError');
    expect((e as Error).message).toMatch(/^This question scans too much of the chain: about 1\.6 billion rows/);
  });
});
