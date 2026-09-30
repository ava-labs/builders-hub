import { describe, expect, it } from 'vitest';

import { fmt } from '@/components/explorer-v2/evm/query-format';

const tick = (v: number, format: Parameters<typeof fmt>[1]) => fmt(v, format, 'AVAX', true);

describe('an axis tick', () => {
  it('is a bare figure: no unit the chart names, none of the zeros fixed places add', () => {
    expect([0, 30, 60, 90, 120].map((v) => tick(v, 'avax'))).toEqual(['0', '30', '60', '90', '120']);
    expect([0.5, 0.25, 0.0001, 1.5].map((v) => tick(v, 'avax'))).toEqual(['0.5', '0.25', '0.0001', '1.5']);
    expect([2000, 8000, 20_000, 12_500].map((v) => tick(v, 'avax'))).toEqual(['2,000', '8,000', '20k', '12.5k']);
    expect([3.6e11, 2.7e11, 1.2e6, 0].map((v) => tick(v, 'gas'))).toEqual(['360B', '270B', '1.2M', '0']);
    expect([0, 10, 12.5, 2.5].map((v) => tick(v, 'percent'))).toEqual(['0%', '10%', '12.5%', '2.5%']);
    expect([1.5, 2].map((v) => tick(v, 'seconds'))).toEqual(['1.5 s', '2 s']);
    expect([0, 12.5, 1.2e6].map((v) => tick(v, 'usd'))).toEqual(['$0', '$12.5', '$1.2M']);
    expect([1e4, 25_000, 1.5].map((v) => tick(v, 'number'))).toEqual(['10k', '25k', '1.5']);
    // an outflow drawn below zero reads as its inflow does (r11's G09 ticks read -3.00e+3)
    expect([-3000, -1.5, -20_000, -0.25].map((v) => tick(v, 'avax'))).toEqual(['-3,000', '-1.5', '-20k', '-0.25']);
    expect([-12.5, -2.5].map((v) => tick(v, 'percent'))).toEqual(['-12.5%', '-2.5%']);
    expect([-3000, -12.5].map((v) => tick(v, 'usd'))).toEqual(['-$3,000', '-$12.5']);
  });
});

describe('a figure', () => {
  it('keeps its fixed places and its unit off an axis', () => {
    expect(fmt(120, 'avax', 'AVAX')).toBe('120.000 AVAX');
    expect(fmt(3.6e11, 'gas', 'AVAX')).toBe('360.00B gas');
    expect(fmt(10, 'percent', 'AVAX')).toBe('10.0%');
    expect(fmt('n/a', 'avax', 'AVAX')).toBe('n/a');
  });

  it('writes 1,000 to 9,999 with its thousands comma', () => {
    expect(fmt(6278.47, 'avax', 'AVAX')).toBe('6,278.47 AVAX');
    expect(fmt(6278, 'avax', 'AVAX')).toBe('6,278 AVAX');
    expect(fmt(1234.5, 'usd', 'AVAX')).toBe('$1,234.50');
  });
});
