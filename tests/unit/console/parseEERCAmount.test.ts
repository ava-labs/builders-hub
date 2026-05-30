import { describe, expect, it } from 'vitest';

import { parseEERCAmount } from '@/lib/eerc/parseAmount';

describe('parseEERCAmount', () => {
  it('parses whole numbers', () => {
    expect(parseEERCAmount('1')).toBe(100n);
    expect(parseEERCAmount('42')).toBe(4200n);
    expect(parseEERCAmount('1000000')).toBe(100000000n);
  });

  it('parses values with one decimal digit', () => {
    expect(parseEERCAmount('1.5')).toBe(150n);
    expect(parseEERCAmount('0.5')).toBe(50n);
  });

  it('parses values with exactly two decimal digits', () => {
    expect(parseEERCAmount('1.23')).toBe(123n);
    expect(parseEERCAmount('0.07')).toBe(7n);
    expect(parseEERCAmount('99.99')).toBe(9999n);
  });

  it('rounds half-up at the 2-decimal boundary', () => {
    // 3rd decimal < 5 → truncate
    expect(parseEERCAmount('1.234')).toBe(123n);
    expect(parseEERCAmount('0.001')).toBe(null); // rounds to 0 → rejected
    // 3rd decimal >= 5 → round up
    expect(parseEERCAmount('1.235')).toBe(124n);
    expect(parseEERCAmount('0.005')).toBe(1n);
    expect(parseEERCAmount('0.999')).toBe(100n); // carries into whole
    expect(parseEERCAmount('1.999')).toBe(200n); // carries into whole
  });

  it('preserves precision past the JS Number safe range', () => {
    // 16 digits of whole number — Number() would round at this scale.
    // 1234567890123456.78 is past 2^53 (≈ 9.007e15) so a float can't
    // hold it exactly; the string-based parser must.
    const huge = '1234567890123456.78';
    expect(parseEERCAmount(huge)).toBe(123456789012345678n);
  });

  it('rejects non-numeric input', () => {
    expect(parseEERCAmount('')).toBe(null);
    expect(parseEERCAmount('abc')).toBe(null);
    expect(parseEERCAmount('1.2.3')).toBe(null);
    expect(parseEERCAmount('-1')).toBe(null);
    expect(parseEERCAmount('1e3')).toBe(null);
    expect(parseEERCAmount('.5')).toBe(null); // require leading digit
    expect(parseEERCAmount('1.')).toBe(null); // require trailing digit
  });

  it('rejects zero amounts', () => {
    expect(parseEERCAmount('0')).toBe(null);
    expect(parseEERCAmount('0.00')).toBe(null);
    expect(parseEERCAmount('0.0001')).toBe(null); // rounds to 0
  });

  it('trims surrounding whitespace', () => {
    expect(parseEERCAmount('  1.50  ')).toBe(150n);
    expect(parseEERCAmount('\t42\n')).toBe(4200n);
  });
});
