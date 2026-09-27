import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('ai', async (importOriginal) => ({ ...(await importOriginal<typeof import('ai')>()), generateText: vi.fn() }));

import { generateText } from 'ai';
import { designVisual, visualSpecSchema, writeReading } from '@/lib/explorer-query/visual';

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

  it('draws ins and outs either side of zero, and a net only with an outflow below it', async () => {
    const flowInput = {
      ...input,
      question: 'How much USDC went into and out of Aave each day?',
      columns: [{ name: 'day', type: 'Date' }, { name: 'usdc_in', type: 'Float64' }, { name: 'usdc_out', type: 'Float64' }],
      rows: [{ day: '2026-09-26', usdc_in: 5, usdc_out: 3 }],
    };
    const series = (column: string, label: string, below?: boolean) => ({ ...spec.panels[0].series[0], column, label, format: 'compact', ...(below === undefined ? {} : { below }) });
    const panel = { ...spec.panels[0], title: 'USDC in and out', x: 'day', series: [series('usdc_in', 'In'), series('usdc_out', 'Out')], net: true };
    const results: unknown[] = [];
    vi.mocked(generateText).mockImplementationOnce((async (opts: DesignCall) => {
      results.push(await opts.tools.design.execute({ ...spec, panels: [panel] }));
      results.push(await opts.tools.design.execute({ ...spec, panels: [{ ...panel, series: [series('usdc_in', 'In'), series('usdc_out', 'Out', true)] }] }));
      return {};
    }) as unknown as typeof generateText);
    const out = await designVisual(flowInput);
    expect(results[0]).toMatchObject({ error: expect.stringContaining('below: true') });
    expect(results[1]).toEqual({ ok: true });
    expect(out.visual.panels[0]).toMatchObject({ net: true, series: [{ column: 'usdc_in' }, { column: 'usdc_out', below: true }] });
    // a saved visual from before the flag reads as before
    expect(visualSpecSchema.parse(spec).panels[0].series[0].below).toBeUndefined();
  });

  it('holds a callout to its length as the page shows it: three full addresses pass, one too long as shown is refused', async () => {
    const a = (c: string) => `0x${c.repeat(40)}`;
    const three = `The same 300.1k USDT went from ${a('1')} to ${a('2')}, then on to ${a('3')} within 3 minutes.`;
    const long = 'Fees rose on every day of the week. '.repeat(5).trim();
    const results: unknown[] = [];
    vi.mocked(generateText).mockImplementationOnce((async (opts: DesignCall) => {
      results.push(await opts.tools.design.execute({ ...spec, callouts: [long] }));
      results.push(await opts.tools.design.execute({ ...spec, callouts: [three] }));
      return {};
    }) as unknown as typeof generateText);
    const out = await designVisual({ ...input, rows: [{ t: '2026-09-27 00:00:00', fees_avax: 1, from: a('1'), via: a('2'), to: a('3') }] });
    // the schema the model's call is checked against takes the full addresses too
    expect(three.length).toBeGreaterThan(160);
    expect(visualSpecSchema.safeParse({ ...spec, callouts: [three] }).success).toBe(true);
    expect(results[0]).toMatchObject({ error: expect.stringContaining('as the page shows it') });
    expect(results[1]).toEqual({ ok: true });
    expect(out.visual.callouts).toEqual([three]);
  });

  it('takes a flow panel from the column value comes from to the column it goes to, with one amount', async () => {
    const a = (c: string) => `0x${c.repeat(40)}`;
    const flowInput = {
      ...input,
      question: 'Where did USDC go yesterday?',
      columns: [{ name: 'from_address', type: 'Nullable(String)' }, { name: 'to_address', type: 'Nullable(String)' }, { name: 'usdc_moved', type: 'Float64' }],
      rows: [{ from_address: a('1'), to_address: a('2'), usdc_moved: 5 }],
    };
    const panel = { ...spec.panels[0], title: 'Where USDC went', kind: 'flow', x: 'from_address', series: [{ ...spec.panels[0].series[0], column: 'usdc_moved', label: 'USDC moved', format: 'number' }] };
    const results: unknown[] = [];
    vi.mocked(generateText).mockImplementationOnce((async (opts: DesignCall) => {
      for (const p of [panel, { ...panel, target: 'from_address' }, { ...panel, target: 'to_address', series: [{ ...panel.series[0], column: 'to_address' }] }, { ...panel, target: 'to_addr' }, { ...panel, target: 'to_address' }])
        results.push(await opts.tools.design.execute({ ...spec, panels: [p] }));
      return {};
    }) as unknown as typeof generateText);
    const out = await designVisual(flowInput);
    expect(results.slice(0, 3)).toEqual([
      { error: expect.stringContaining('target (the column it goes to') },
      { error: expect.stringContaining('target (the column it goes to') },
      { error: expect.stringContaining('to_address is not a number column') },
    ]);
    expect(results[3]).toMatchObject({ error: expect.stringContaining('panel target to_addr') });
    expect(results[4]).toEqual({ ok: true });
    expect(out.visual.panels[0]).toMatchObject({ kind: 'flow', x: 'from_address', target: 'to_address' });
    expect(visualSpecSchema.safeParse({ ...spec, panels: [{ ...panel, target: 'to_address' }] }).success).toBe(true);
  });

  it('refuses a ranking whose names repeat in the rows, as a sender does in rows of pairs', async () => {
    const a = (c: string) => `0x${c.repeat(40)}`;
    const pairs = {
      ...input,
      question: 'Where did USDC go yesterday?',
      columns: [{ name: 'from_address', type: 'Nullable(String)' }, { name: 'to_address', type: 'Nullable(String)' }, { name: 'usdc_moved', type: 'Float64' }],
      rows: [{ from_address: a('1'), to_address: a('2'), usdc_moved: 5 }, { from_address: a('1'), to_address: a('3'), usdc_moved: 4 }],
    };
    const series = [{ ...spec.panels[0].series[0], column: 'usdc_moved', label: 'USDC moved', format: 'number' }];
    const results: unknown[] = [];
    vi.mocked(generateText).mockImplementationOnce((async (opts: DesignCall) => {
      results.push(await opts.tools.design.execute({ ...spec, panels: [{ ...spec.panels[0], title: 'Senders', kind: 'hbar', x: 'from_address', series }] }));
      results.push(await opts.tools.design.execute({ ...spec, panels: [{ ...spec.panels[0], title: 'Receivers', kind: 'hbar', x: 'to_address', series }] }));
      return {};
    }) as unknown as typeof generateText);
    await designVisual(pairs);
    expect(results[0]).toMatchObject({ error: expect.stringContaining('from_address repeats in these rows') });
    expect(results[1]).toEqual({ ok: true });
  });

  it('reports its model steps and each visual the design tool turned back', async () => {
    vi.mocked(generateText).mockImplementationOnce((async (opts: DesignCall) => {
      await opts.tools.design.execute({ ...spec, panels: [{ ...spec.panels[0], x: 'nope' }] });
      await opts.tools.design.execute(spec);
      // the SDK turns back a call its schema does not take before the tool sees it
      return { steps: [{ content: [{ type: 'tool-error', error: 'Invalid input for tool design' }] }, { content: [{ type: 'tool-result' }] }] };
    }) as unknown as typeof generateText);
    const out = await designVisual(input);
    expect(out).toMatchObject({ fromDesigner: true, steps: 2, refused: [expect.stringContaining('these columns are not in the rows: panel x nope'), 'Invalid input for tool design'] });
    // a design the tool took at once reports no refusal
    vi.mocked(generateText).mockImplementationOnce(designs(true));
    expect(await designVisual(input)).toMatchObject({ steps: 0, refused: [] });
  });

  it('asks the designer for low effort on every call', async () => {
    vi.mocked(generateText).mockImplementationOnce(designs(false)).mockImplementationOnce(designs(true));
    await designVisual(input);
    const efforts = vi.mocked(generateText).mock.calls.map((c) => (c[0] as { providerOptions?: { anthropic?: { effort?: string } } }).providerOptions?.anthropic?.effort);
    expect(efforts).toEqual(['low', 'low']);
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
