import { describe, expect, it, vi } from 'vitest';

// The helper lives in the tool's component file, which imports the toolbox hooks. Under Vitest,
// '@avalanche-sdk/client/chains' asks viem/chains for chains that its viem copy lacks, so the import fails. The test
// needs no chain, so a stub is enough.
vi.mock('@avalanche-sdk/client/chains', () => ({ avalanche: { id: 43114 }, avalancheFuji: { id: 43113 } }));

import {
  DEFAULT_LOOKBACK_BLOCKS,
  resolveSearchStartBlock,
} from '@/components/toolbox/console/permissioned-l1s/remove-expired-registration/RemoveExpiredValidatorRegistration';

describe('resolveSearchStartBlock', () => {
  it('starts a blank field 100k blocks before the latest block', () => {
    expect(DEFAULT_LOOKBACK_BLOCKS).toBe(100_000n);
    expect(resolveSearchStartBlock('', 48_000_000n)).toBe(47_900_000n);
  });

  it('treats a field with only spaces as blank', () => {
    expect(resolveSearchStartBlock('   ', 48_000_000n)).toBe(47_900_000n);
  });

  it('starts a blank field at block 0 when the chain is shorter than the lookback', () => {
    expect(resolveSearchStartBlock('', 99_999n)).toBe(0n);
    expect(resolveSearchStartBlock('', 100_000n)).toBe(0n);
    expect(resolveSearchStartBlock('', 0n)).toBe(0n);
  });

  it('keeps 0 from Search All, so the search starts at genesis', () => {
    expect(resolveSearchStartBlock('0', 48_000_000n)).toBe(0n);
  });

  it('uses a typed block number, trimmed', () => {
    expect(resolveSearchStartBlock('47123456', 48_000_000n)).toBe(47_123_456n);
    expect(resolveSearchStartBlock(' 47123456 ', 48_000_000n)).toBe(47_123_456n);
  });

  it('returns a typed block above the latest block unchanged; the caller finds no events', () => {
    expect(resolveSearchStartBlock('50000000', 48_000_000n)).toBe(50_000_000n);
  });

  it('throws on text that is not an integer', () => {
    expect(() => resolveSearchStartBlock('abc', 48_000_000n)).toThrow(SyntaxError);
    expect(() => resolveSearchStartBlock('1.5', 48_000_000n)).toThrow(SyntaxError);
  });
});
