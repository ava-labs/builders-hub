import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('ai', async (importOriginal) => ({ ...(await importOriginal<typeof import('ai')>()), generateText: vi.fn() }));

import { generateText } from 'ai';
import { writeReading } from '@/lib/explorer-query/visual';

// a model call that hands the reading tool these callouts, as the model would
type Call = { tools: { reading: { execute: (input: { callouts: string[] }) => Promise<unknown> } } };
const says = (callouts: string[]) =>
  (async (opts: Call) => {
    await opts.tools.reading.execute({ callouts });
    return {};
  }) as unknown as typeof generateText;

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
