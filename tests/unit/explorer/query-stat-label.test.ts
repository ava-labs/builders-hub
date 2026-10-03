import { beforeEach, describe, expect, it, vi } from 'vitest';

const runQuery = vi.hoisted(() => vi.fn());
const totalsOf = vi.hoisted(() => vi.fn());
const getRecipe = vi.hoisted(() => vi.fn());
const putRecipe = vi.hoisted(() => vi.fn(async () => {}));
vi.mock('ai', async (importOriginal) => ({ ...(await importOriginal<typeof import('ai')>()), generateText: vi.fn() }));
vi.mock('@/lib/explorer-query/clickhouse', () => ({
  runQuery,
  anchored: vi.fn(async (sql: string) => ({ sql, anchor: null, sources: [] })),
  schemaCard: vi.fn(async () => ''),
  coverage: vi.fn(async () => null),
  coverageText: vi.fn(() => ''),
}));
vi.mock('@/lib/explorer-query/cache', () => ({ getRecipe, putRecipe, recipeKey: vi.fn(() => 'a'.repeat(32)) }));
vi.mock('@/lib/explorer-query/enrich', () => ({ fillDrill: vi.fn(), nameRows: vi.fn(async () => ({})) }));
vi.mock('@/lib/explorer-query/cut', () => ({ cutOf: vi.fn(() => null), newestSql: vi.fn(() => null), totalsOf }));
vi.mock('@/lib/explorer-query/sources', () => ({ versionLines: vi.fn(async () => []) }));

import { answerQuestion } from '@/lib/explorer-query/answer';
import { averageLabel, wholeFigure, wholeLabel } from '@/lib/explorer-query/stat-label';
import { figures, type VisualSpec } from '@/lib/explorer-query/visual';
import type { Totals } from '@/lib/explorer-query/types';

// the hour's 20 largest fees, of 10,938 transactions: the replay of "Which transactions paid the highest fees in the
// last hour?" whose "Top 20 fees" card showed the whole hour's 58.86 AVAX, where the 20 paid 6.39
const TOTALS: Totals = { rows: 10938, newest: false, sum: { fee_avax: 58.86 }, count: { fee_avax: 10938 }, min: { fee_avax: 0 }, max: { fee_avax: 0.9487 }, distinct: { from_address: 1901 } };
const stat = (label: string, agg: string, column = 'fee_avax', sub?: string) => ({ label, agg, column, format: 'avax', ...(sub ? { sub } : {}) }) as VisualSpec['stats'][number];
const COLUMNS = [
  { name: 'tx_hash', type: 'String' },
  { name: 'from_address', type: 'String' },
  { name: 'fee_avax', type: 'Float64' },
];
const ROWS = Array.from({ length: 20 }, (_, i) => ({ tx_hash: `0x${i}`, from_address: `0xa${i % 15}`, fee_avax: 0.9487 - i * 0.03 }));

describe("a headline stat's figure", () => {
  it('is the whole answer\'s when a LIMIT cut the rows and the totals were read', () => {
    expect(wholeFigure(TOTALS, stat('Fees', 'sum'))).toBe(58.86);
    expect(wholeFigure(TOTALS, stat('Average fee', 'avg'))).toBeCloseTo(58.86 / 10938);
    expect(wholeFigure(TOTALS, stat('Transactions', 'count'))).toBe(10938);
    expect(wholeFigure(TOTALS, stat('Senders', 'distinct', 'from_address'))).toBe(1901);
    expect(wholeFigure(TOTALS, stat('Top fee', 'max'))).toBe(0.9487);
    expect(wholeFigure(TOTALS, stat('Senders', 'sum', 'from_address'))).toBeNull();
    expect(wholeFigure(null, stat('Fees', 'sum'))).toBeNull();
  });
});

describe("a stat's label over a cut answer", () => {
  it('names the whole answer, never the rows the LIMIT kept', () => {
    expect(wholeLabel([stat('Top fee', 'max'), stat('Top 20 fees', 'sum')], 20, TOTALS)).toBe(
      '"Top 20 fees" shows its figure over all 10938 rows, not the 20 here: the LIMIT cut the rest, and a stat\'s sum, average, count or distinct reads them all. Name the whole set ("Fees burned", "Transactions"), or show max or min',
    );
    for (const s of [stat('Fees of these', 'sum'), stat('Fees', 'sum', 'fee_avax', 'of the 20 shown'), stat('Largest fees', 'sum'), stat('Senders', 'distinct', 'from_address', 'top 20')]) expect(wholeLabel([s], 20, TOTALS), s.label).not.toBeNull();
    // the whole set's words, a peak, a figure the totals do not hold, and rows the LIMIT did not cut
    expect(wholeLabel([stat('Fees burned', 'sum', 'fee_avax', 'last hour'), stat('Top fee', 'max'), stat('Senders', 'distinct', 'from_address')], 20, TOTALS)).toBeNull();
    expect(wholeLabel([stat('Top 20 senders', 'sum', 'from_address')], 20, TOTALS)).toBeNull();
    expect(wholeLabel([stat('Top 20 fees', 'sum')], 20, { ...TOTALS, rows: 20 })).toBeNull();
    expect(wholeLabel([stat('Top 20 fees', 'sum')], 20, null)).toBeNull();
    // "24h" is no count of the rows shown
    expect(wholeLabel([stat('Fees, 24h', 'sum')], 24, TOTALS)).toBeNull();
  });

  it("is said to the designer: a stat's figure is over all the rows", () => {
    const f = figures({ columns: COLUMNS, rows: ROWS, names: {}, totals: TOTALS }).join('\n');
    expect(f).toContain("A stat's sum, average, count or distinct shows the figure over all 10938, so its label names the whole set, never these 20.");
  });

  it('still says average for an extreme of the rows\' own averages', () => {
    expect(averageLabel({ label: 'Peak gas price', agg: 'max', column: 'avg_gas_price_gwei' }).label).toBe('Peak average gas price');
  });
});

describe('a kept layout', () => {
  const VISUAL = (label: string) => ({ stats: [stat('Top fee', 'max'), stat(label, 'sum')], panels: [], callouts: [] }) as unknown as VisualSpec;
  const RECIPE = (label: string) => ({
    question: 'Which transactions paid the highest fees in the last hour?',
    title: 'Highest fees paid in the last hour',
    note: 'The 20 transactions with the largest fees paid in the last hour.',
    sql: "SELECT concat('0x', hex(hash)) AS tx_hash, lower(concat('0x', hex(`from`))) AS from_address, toFloat64(gas_used) * gas_price / 1e18 AS fee_avax FROM raw_txs WHERE chain_id = 43114 AND block_time >= now() - INTERVAL 1 HOUR ORDER BY fee_avax DESC LIMIT 20",
    chart: { kind: 'bar', x: 'tx_hash', series: [{ column: 'fee_avax', label: 'Fee' }] },
    drill: null,
    visual: VISUAL(label),
    writer: 'W',
    at: Date.now(),
  });
  const ask = () => answerQuestion({ chainId: 43114, chainName: 'Avalanche C-Chain', symbol: 'AVAX', prompt: 'Which transactions paid the highest fees in the last hour?', history: [], baseUrl: 'http://localhost:3000', emit: () => {} });

  beforeEach(() => {
    runQuery.mockReset();
    runQuery.mockResolvedValue({ columns: COLUMNS, rows: ROWS, rowCount: 20, elapsedMs: 1, rowsRead: 1, truncated: true });
    totalsOf.mockReset();
    totalsOf.mockResolvedValue(TOTALS);
    getRecipe.mockReset();
    putRecipe.mockClear();
  });

  it('whose stat names the rows shown is laid out again, and forgotten', async () => {
    getRecipe.mockResolvedValue(RECIPE('Top 20 fees'));
    const a = await ask();
    expect(a?.draftVisual).toBe(true);
    expect(a?.visual?.stats.map((s) => s.label)).not.toContain('Top 20 fees');
    expect(putRecipe).toHaveBeenCalledWith('a'.repeat(32), expect.objectContaining({ visual: null }));
  });

  it('whose stats name the whole answer stays', async () => {
    getRecipe.mockResolvedValue(RECIPE('Fees burned'));
    const a = await ask();
    expect(a?.draftVisual).toBe(false);
    expect(a?.visual?.stats.map((s) => s.label)).toEqual(['Top fee', 'Fees burned']);
    expect(putRecipe).not.toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ visual: null }));
  });
});
