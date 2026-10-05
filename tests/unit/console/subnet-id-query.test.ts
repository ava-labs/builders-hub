import { describe, expect, it } from 'vitest';
import { resolveSubnetIdQuery } from '@/components/toolbox/utils/subnetIdQuery';

const L1_A = 'subnet-id-of-l1-a';
const L1_B = 'subnet-id-of-l1-b';

function run(input: Partial<Parameters<typeof resolveSubnetIdQuery>[0]> = {}) {
  return resolveSubnetIdQuery({
    query: L1_A,
    stored: '',
    isTestnet: true,
    networkKnown: true,
    done: new Set(),
    ...input,
  });
}

describe('resolveSubnetIdQuery', () => {
  it('sets the L1 from the query when the store holds another L1 or none', () => {
    expect(run({ stored: '' })).toEqual({ subnetId: L1_A, doneKey: `testnet:${L1_A}` });
    expect(run({ stored: L1_B })).toEqual({ subnetId: L1_A, doneKey: `testnet:${L1_A}` });
  });

  it('keeps the store when the query equals the stored L1, so the flow keeps its progress', () => {
    expect(run({ stored: L1_A })).toEqual({ subnetId: null, doneKey: `testnet:${L1_A}` });
  });

  it('applies once per network and value: the user can pick another L1 after it', () => {
    const done = new Set([`testnet:${L1_A}`]);
    expect(run({ stored: L1_B, done })).toEqual({ subnetId: null, doneKey: null });
    expect(run({ stored: '', done })).toEqual({ subnetId: null, doneKey: null });
  });

  it('applies again to the store of the other network', () => {
    const done = new Set([`mainnet:${L1_A}`]);
    expect(run({ stored: L1_B, done })).toEqual({ subnetId: L1_A, doneKey: `testnet:${L1_A}` });
    expect(run({ isTestnet: false, stored: L1_B, done })).toEqual({ subnetId: null, doneKey: null });
  });

  it('applies a new query value in the same mount', () => {
    const done = new Set([`testnet:${L1_A}`]);
    expect(run({ query: L1_B, stored: L1_A, done })).toEqual({ subnetId: L1_B, doneKey: `testnet:${L1_B}` });
  });

  it('waits for the wallet network, and does not mark the query as done', () => {
    expect(run({ networkKnown: false })).toEqual({ subnetId: null, doneKey: null });
  });

  it('ignores a missing or blank query, and trims the value', () => {
    expect(run({ query: null, stored: L1_B })).toEqual({ subnetId: null, doneKey: null });
    expect(run({ query: '  ', stored: L1_B })).toEqual({ subnetId: null, doneKey: null });
    expect(run({ query: ` ${L1_A} ` })).toEqual({ subnetId: L1_A, doneKey: `testnet:${L1_A}` });
  });
});
