import { describe, expect, it } from 'vitest';

import { formatOf } from '@/components/explorer-v2/evm/QueryRows';

describe('the unit a column is in, by its name', () => {
  it('reads a percent from a word of the name, not from letters inside one (r11 G10: "390.0%" registrations)', () => {
    for (const c of ['registrations', 'generated_blocks', 'shares', 'operators']) expect(formatOf(c, null), c).toBe('number');
    for (const c of ['share_pct', 'fail_rate', 'revert_percent', 'apr', 'share_of_volume']) expect(formatOf(c, null), c).toBe('percent');
  });

  it('reads a fee in usd as dollars, and one in AVAX as AVAX', () => {
    expect(formatOf('fees_usd', null)).toBe('usd');
    expect(formatOf('volume_usd', null)).toBe('usd');
    expect(formatOf('fee_avax', null)).toBe('avax');
  });
});
