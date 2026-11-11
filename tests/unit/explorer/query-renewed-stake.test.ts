import { describe, expect, it } from 'vitest';
import { pchainPrompt } from '@/lib/explorer-query/prompt';

/* "How much staked AVAX unlocks in the next 7 days" summed every validator whose end_time is in the 7 days: 34.9M
   AVAX, of which 3.05M was of 47 auto-renewed validators. An auto-renewed validator's end_time is its cycle's end,
   and it starts the next cycle under the same transaction, so that stake does not unlock. */

const prompt = (chainId: number) => pchainPrompt({ chainId, network: 'mainnet', schema: '', coverage: null, lines: null });

describe('stake that ends', () => {
  it('is counted apart from stake that renews, on the mainnet P-Chain', () => {
    const text = prompt(1);
    expect(text).toContain('next_period > 0 marks an auto-renewed validator');
    expect(text).toContain('sumIf(weight, ifNull(next_period, 0) = 0) / 1e9 AS unlocking_avax');
    expect(text).toContain('sumIf(weight, ifNull(next_period, 0) > 0) / 1e9 AS renewing_avax');
  });

  it('is not in the Fuji prompt, which stays as it was', () => {
    expect(prompt(5)).not.toContain('next_period');
  });
});
