import { describe, expect, it, vi } from 'vitest';

// The helper lives in the tool's component file, which imports the toolbox hooks. Under Vitest,
// '@avalanche-sdk/client/chains' asks viem/chains for chains that its viem copy lacks, so the import fails. The test
// needs no chain, so a stub is enough.
vi.mock('@avalanche-sdk/client/chains', () => ({ avalanche: { id: 43114 }, avalancheFuji: { id: 43113 } }));

import { exportAmountError } from '@/components/toolbox/console/primary-network/CrossChainTransfer';

// The spendable maximum of the audit repro: the balance less the 0.001 AVAX fee buffer, in nAVAX
const MAX = 20_012_999_267n;
const INVALID = 'Please enter a valid positive amount.';
const OVER_MAX = 'Amount exceeds available balance of 20.012999267 AVAX (your balance less 0.001 AVAX for the fees).';

describe('exportAmountError', () => {
  it('accepts an amount up to the spendable maximum', () => {
    expect(exportAmountError('1', MAX)).toBeNull();
    expect(exportAmountError('20.012999267', MAX)).toBeNull();
    expect(exportAmountError('0.000000001', MAX)).toBeNull();
  });

  it('refuses one nAVAX over the spendable maximum and names the maximum', () => {
    expect(exportAmountError('20.012999268', MAX)).toBe(OVER_MAX);
  });

  it('rounds a 10th decimal before it compares the amount with the maximum', () => {
    expect(exportAmountError('20.0129992674', MAX)).toBeNull();
    expect(exportAmountError('20.0129992675', MAX)).toBe(OVER_MAX);
  });

  it('refuses any amount when nothing is spendable', () => {
    expect(exportAmountError('1', 0n)).toBe(
      'Amount exceeds available balance of 0 AVAX (your balance less 0.001 AVAX for the fees).',
    );
  });

  it('refuses an empty, zero, negative or non-decimal amount', () => {
    for (const amount of ['', '0', '0.0', '-1', 'abc', '1e-3', 'Infinity', '0x10']) {
      expect(exportAmountError(amount, MAX), amount).toBe(INVALID);
    }
  });

  it('refuses an amount that rounds to 0 nAVAX', () => {
    expect(exportAmountError('0.0000000001', MAX)).toBe('Amount is below the smallest exportable unit (1 nAVAX).');
  });
});
