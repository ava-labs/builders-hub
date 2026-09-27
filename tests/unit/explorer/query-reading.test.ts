import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('ai', async (importOriginal) => ({ ...(await importOriginal<typeof import('ai')>()), generateText: vi.fn() }));

import { generateText } from 'ai';
import { designVisual, writeReading } from '@/lib/explorer-query/visual';

// a model call that hands the reading tool these callouts, as the model would
type Call = { tools: { reading: { execute: (input: { callouts: string[] }) => Promise<unknown> } } };
const says = (callouts: string[]) =>
  (async (opts: Call) => {
    await opts.tools.reading.execute({ callouts });
    return {};
  }) as unknown as typeof generateText;

describe('designVisual', () => {
  const input = {
    question: 'Fees burned per 5 minutes',
    title: 'Fees burned',
    note: '',
    symbol: 'AVAX',
    columns: [{ name: 't', type: 'DateTime' }, { name: 'fees_avax', type: 'Float64' }],
    rows: [{ t: '2026-09-27 00:00:00', fees_avax: 1 }],
    names: {},
    chart: { kind: 'bar' as const, x: 't', series: [{ column: 'fees_avax', label: 'Fees burned' }] },
  };
  const spec = {
    stats: [],
    panels: [{ title: 'Fees burned', kind: 'bar', x: 't', series: [{ column: 'fees_avax', label: 'Fees burned', format: 'avax', axis: 'left', mark: 'auto', transform: 'none', dashed: false }], markers: [], bands: [], stacked: false, sortDir: 'desc', referenceLines: [], width: 'full' }],
    callouts: [],
  };
  // a model call that reads the stop conditions before and after it hands the design tool a visual
  type Stop = (o: { steps: unknown[] }) => boolean | PromiseLike<boolean>;
  type DesignCall = { stopWhen: Stop[]; tools: { design: { execute: (input: unknown) => Promise<unknown> } } };
  const seen: boolean[][] = [];
  const designs = (lands: boolean) =>
    (async (opts: DesignCall) => {
      const stop = async () => (await Promise.all(opts.stopWhen.map((f) => f({ steps: [] })))).some(Boolean);
      const before = await stop();
      if (lands) await opts.tools.design.execute(spec);
      seen.push([before, await stop()]);
      return {};
    }) as unknown as typeof generateText;

  beforeEach(() => {
    vi.mocked(generateText).mockReset();
    seen.length = 0;
  });

  it('stops each call once the design tool has the visual', async () => {
    vi.mocked(generateText).mockImplementationOnce(designs(false)).mockImplementationOnce(designs(true));
    const out = await designVisual(input);
    expect(out.fromDesigner).toBe(true);
    expect(seen).toEqual([
      [false, false],
      [false, true],
    ]);
  });
});

describe('writeReading', () => {
  const input = { question: 'Fees burned per 5 minutes', title: 'Fees burned', note: '', symbol: 'AVAX', columns: [{ name: 'fees_avax', type: 'Float64' }], rows: [{ fees_avax: 1 }], names: {} };

  beforeEach(() => {
    vi.mocked(generateText).mockReset();
  });

  it('writes an empty reading once more', async () => {
    vi.mocked(generateText).mockImplementationOnce(says([])).mockImplementationOnce(says(['Fees peaked at 9.39 AVAX.']));
    expect(await writeReading(input)).toEqual(['Fees peaked at 9.39 AVAX.']);
    expect(generateText).toHaveBeenCalledTimes(2);
  });

  it('asks twice at most, and keeps a first reading', async () => {
    vi.mocked(generateText).mockImplementation(says([]));
    expect(await writeReading(input)).toEqual([]);
    expect(generateText).toHaveBeenCalledTimes(2);
    vi.mocked(generateText).mockReset();
    vi.mocked(generateText).mockImplementation(says(['Fees peaked at 9.39 AVAX.']));
    expect(await writeReading(input)).toEqual(['Fees peaked at 9.39 AVAX.']);
    expect(generateText).toHaveBeenCalledTimes(1);
  });
});
