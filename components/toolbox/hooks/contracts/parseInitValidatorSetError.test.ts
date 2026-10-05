import { describe, expect, it } from 'vitest';
import { parseInitValidatorSetError } from './parseInitValidatorSetError';

// Shape of the real failure from issue #4464: the SDK simulates first and
// throws the raw viem revert dump as an Error message.
const INVALID_TOTAL_WEIGHT_DUMP =
  'initializeValidatorSet would revert: The contract function "initializeValidatorSet" reverted. ' +
  'Error: InvalidTotalWeight(uint64 weight) (100) Contract Call: address: 0xfacade0000000000000000000000000000000000';

describe('parseInitValidatorSetError', () => {
  it('maps InvalidTotalWeight to uninitialized-manager guidance with the called address', () => {
    const mapped = parseInitValidatorSetError(
      new Error(INVALID_TOTAL_WEIGHT_DUMP),
      '0xfacade0000000000000000000000000000000000',
    );
    expect(mapped).not.toBeNull();
    expect(mapped!.message).toContain('0xfacade0000000000000000000000000000000000');
    expect(mapped!.message).toMatch(/never been initialized/i);
    expect(mapped!.remediation[0].href).toBe('/console/permissioned-l1s/validator-manager-setup');
  });

  it('falls back to a generic address phrase when the manager address is unknown', () => {
    const mapped = parseInitValidatorSetError(new Error(INVALID_TOTAL_WEIGHT_DUMP), null);
    expect(mapped!.message).toContain('recorded in the conversion');
  });

  it('maps InvalidWarpMessage to ProposerVM guidance with the advance tool link', () => {
    const mapped = parseInitValidatorSetError(new Error('Error: InvalidWarpMessage()'), '0xfacade');
    expect(mapped!.message).toMatch(/ProposerVM/);
    expect(mapped!.message).toMatch(/produce a block/i);
    expect(mapped!.remediation.map((r) => r.href)).toContain('/console/layer-1/advance-pchain-view');
  });

  it('keeps the ProposerVM guidance for a manager on an L1', () => {
    const mapped = parseInitValidatorSetError(new Error('Error: InvalidWarpMessage()'), '0xfacade', false);
    expect(mapped!.message).toMatch(/produce a block/i);
    expect(mapped!.remediation.map((r) => r.href)).toContain('/console/layer-1/advance-pchain-view');
  });

  it('tells a C-Chain manager to aggregate again, with no block production and no advance tool link', () => {
    const mapped = parseInitValidatorSetError(new Error('Error: InvalidWarpMessage()'), '0xfacade', true);
    expect(mapped).not.toBeNull();
    expect(mapped!.message).toMatch(/C-Chain/);
    expect(mapped!.message).toContain('Re-aggregate signatures');
    expect(mapped!.message).toContain('you do not need to produce a block');
    expect(mapped!.message).toContain('wait 5 minutes');
    expect(mapped!.message).not.toMatch(/zero-value transfer/i);
    expect(mapped!.remediation.map((r) => r.href)).not.toContain('/console/layer-1/advance-pchain-view');
  });

  it('maps the other reverts the same way for a C-Chain manager', () => {
    expect(
      parseInitValidatorSetError(new Error(INVALID_TOTAL_WEIGHT_DUMP), '0xfacade', true)!.remediation[0].href,
    ).toBe('/console/permissioned-l1s/validator-manager-setup');
    expect(
      parseInitValidatorSetError(new Error('Error: InvalidInitializationStatus()'), '0xfacade', true)!.message,
    ).toMatch(/already initialized/i);
    expect(parseInitValidatorSetError(new Error('fetch failed'), '0xfacade', true)).toBeNull();
  });

  it('maps InvalidInitializationStatus to an already-initialized message', () => {
    const mapped = parseInitValidatorSetError(new Error('Error: InvalidInitializationStatus()'), '0xfacade');
    expect(mapped!.message).toMatch(/already initialized/i);
  });

  it('returns null for everything else so the raw error still surfaces', () => {
    expect(parseInitValidatorSetError(new Error('fetch failed'), '0xfacade')).toBeNull();
    expect(parseInitValidatorSetError(undefined, '0xfacade')).toBeNull();
  });
});
