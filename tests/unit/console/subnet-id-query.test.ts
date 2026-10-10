import { describe, expect, it } from 'vitest';
import type { L1ListItem } from '@/components/toolbox/stores/l1ListStore';
import { resolveSubnetIdQuery, walletOnNetwork } from '@/components/toolbox/utils/subnetIdQuery';

const L1_A = 'subnet-id-of-l1-a';
const L1_B = 'subnet-id-of-l1-b';
const FUJI_L1_CHAIN = 779672;
const UNLISTED_L1_CHAIN = 123456;

function run(input: Partial<Parameters<typeof resolveSubnetIdQuery>[0]> = {}) {
  return resolveSubnetIdQuery({
    query: L1_A,
    stored: '',
    completed: false,
    networkKnown: true,
    done: new Set(),
    ...input,
  });
}

describe('walletOnNetwork', () => {
  const fujiList = [{ evmChainId: FUJI_L1_CHAIN, isTestnet: true } as L1ListItem];

  it('agrees on the C-Chain of the same network only', () => {
    expect(walletOnNetwork(43113, true, [])).toBe(true);
    expect(walletOnNetwork(43114, false, [])).toBe(true);
    expect(walletOnNetwork(43113, false, [])).toBe(false);
    expect(walletOnNetwork(43114, true, [])).toBe(false);
  });

  it('agrees on an L1 in the L1 list of the same network', () => {
    expect(walletOnNetwork(FUJI_L1_CHAIN, true, fujiList)).toBe(true);
  });

  it('does not agree when isTestnet names the other network of the L1', () => {
    // A Core client made for an older chain set isTestnet to mainnet after the live read of a Fuji L1
    expect(walletOnNetwork(FUJI_L1_CHAIN, false, [])).toBe(false);
  });

  it('does not know the network with no wallet or on an L1 that the list does not have', () => {
    expect(walletOnNetwork(0, true, fujiList)).toBe(false);
    expect(walletOnNetwork(UNLISTED_L1_CHAIN, true, fujiList)).toBe(false);
  });
});

describe('resolveSubnetIdQuery', () => {
  it('sets the L1 from the query when the store holds another L1 or none', () => {
    expect(run({ stored: '' })).toEqual({ subnetId: L1_A, doneKey: L1_A });
    expect(run({ stored: L1_B })).toEqual({ subnetId: L1_A, doneKey: L1_A });
  });

  it('keeps an unfinished flow when the query equals the stored L1, so a reload keeps its progress', () => {
    expect(run({ stored: L1_A })).toEqual({ subnetId: null, doneKey: L1_A });
  });

  it('keeps a flow that has its P-Chain tx but not its Validator Manager completion', () => {
    // add-validator, remove-validator and change-weight set pChainTxId at step 3, before the completion step 4.
    // The flow is not complete, so a My L1 or NodeList link back to the same L1 must not clear it.
    expect(run({ stored: L1_A, completed: false })).toEqual({ subnetId: null, doneKey: L1_A });
  });

  it('sets the stored L1 again when its flow is complete, so a My L1 link starts a new flow', () => {
    expect(run({ stored: L1_A, completed: true })).toEqual({ subnetId: L1_A, doneKey: L1_A });
    // Once only: the new flow is not cleared again when it completes in the same mount
    expect(run({ stored: L1_A, completed: true, done: new Set([L1_A]) })).toEqual({
      subnetId: null,
      doneKey: null,
    });
  });

  it('starts a new flow from a My L1 link back to an L1 whose flow completed, in a new mount', () => {
    // A user completes a weight change on L1 A, then opens the My L1 link of A to change a weight again. The store
    // still holds A with flowCompleted set, so the query sets A again, which clears the completed flow.
    const first = run({ stored: '' });
    expect(first.subnetId).toBe(L1_A);
    const second = run({ stored: L1_A, completed: true });
    expect(second.subnetId).toBe(L1_A);
  });

  it('applies once per value: the user can pick another L1 after it', () => {
    const done = new Set([L1_A]);
    expect(run({ stored: L1_B, done })).toEqual({ subnetId: null, doneKey: null });
    expect(run({ stored: '', done })).toEqual({ subnetId: null, doneKey: null });
  });

  it('does not write the L1 into the store of the other network after a network switch', () => {
    // The link named an L1 of the first network. The store of the other network holds its own flow (L1 B), in
    // progress or not. The query must not clear it.
    const done = new Set<string>();
    const first = run({ stored: '', done });
    expect(first).toEqual({ subnetId: L1_A, doneKey: L1_A });
    done.add(L1_A);
    expect(run({ stored: L1_B, done })).toEqual({ subnetId: null, doneKey: null });
    expect(run({ stored: '', done })).toEqual({ subnetId: null, doneKey: null });
    expect(run({ stored: L1_A, completed: true, done })).toEqual({ subnetId: null, doneKey: null });
  });

  it('applies a new query value in the same mount', () => {
    const done = new Set([L1_A]);
    expect(run({ query: L1_B, stored: L1_A, done })).toEqual({ subnetId: L1_B, doneKey: L1_B });
  });

  it('waits until the wallet network is known and stable, and does not mark the query as done', () => {
    expect(run({ networkKnown: false })).toEqual({ subnetId: null, doneKey: null });
    expect(run({ networkKnown: false, stored: L1_A, completed: true })).toEqual({ subnetId: null, doneKey: null });
  });

  it('applies to the Fuji store after a reload that first reports the persisted Mainnet C-Chain', () => {
    // WalletSync reports wagmi's persisted chain (43114) before the live read of the Fuji L1. That report is not
    // confirmed, so networkKnown is false, and the mainnet store (L1 B) keeps its flow. The live read then makes Fuji
    // the first known network.
    const done = new Set<string>();
    const early = run({ networkKnown: false, stored: L1_B, done });
    expect(early).toEqual({ subnetId: null, doneKey: null });
    const live = run({ networkKnown: true, stored: '', done });
    expect(live).toEqual({ subnetId: L1_A, doneKey: L1_A });
  });

  it('ignores a missing or blank query, and trims the value', () => {
    expect(run({ query: null, stored: L1_B })).toEqual({ subnetId: null, doneKey: null });
    expect(run({ query: '  ', stored: L1_B })).toEqual({ subnetId: null, doneKey: null });
    expect(run({ query: ` ${L1_A} ` })).toEqual({ subnetId: L1_A, doneKey: L1_A });
  });
});
