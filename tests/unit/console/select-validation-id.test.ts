import { describe, expect, it } from 'vitest';
import { hexToCB58 } from '@avalanche-sdk/client/utils';
import { nodeIdForValidationId } from '@/components/toolbox/components/SelectValidationID';

const HEX_ID = `0x${'b7'.repeat(32)}` as const;
const CB58_ID = hexToCB58(HEX_ID);
const NODE_ID = 'NodeID-7Xhw2mDxuDS44j42TCB6U5579esbSt3Lg';

describe('nodeIdForValidationId', () => {
  it('finds the NodeID from the form that the mapping holds', () => {
    expect(nodeIdForValidationId({ [CB58_ID]: NODE_ID }, CB58_ID)).toBe(NODE_ID);
    expect(nodeIdForValidationId({ [HEX_ID]: NODE_ID }, HEX_ID)).toBe(NODE_ID);
  });

  it('finds the NodeID from the other form', () => {
    expect(nodeIdForValidationId({ [HEX_ID]: NODE_ID }, CB58_ID)).toBe(NODE_ID);
    expect(nodeIdForValidationId({ [CB58_ID]: NODE_ID }, HEX_ID)).toBe(NODE_ID);
  });

  it('returns an empty string for an empty mapping or an empty ID', () => {
    expect(nodeIdForValidationId({}, CB58_ID)).toBe('');
    expect(nodeIdForValidationId({ [CB58_ID]: NODE_ID }, '')).toBe('');
  });

  it('returns an empty string for a partial or mistyped ID, and does not throw', () => {
    const mapping = { [CB58_ID]: NODE_ID };
    // "0", "I", "O", "l" and "-" are not CB58 letters: CB58ToHex throws on them
    expect(nodeIdForValidationId(mapping, 'NodeID-abc')).toBe('');
    expect(nodeIdForValidationId(mapping, '2Pfkn0')).toBe('');
    expect(nodeIdForValidationId(mapping, '0xzz')).toBe('');
  });
});
