import { describe, expect, it } from 'vitest';
import { doorFor } from '@/components/explorer-v2/evm/QueryRows';

const base = '/explorer/avalanche-c-chain';
const h = `0x${'ab'.repeat(32)}`;

describe('doorFor', () => {
  it('opens a 32-byte value as a transaction only in a column named for one', () => {
    for (const c of ['tx_hash', 'hash', 'transaction_hash', 'max_fee_tx', 'deposit_tx_hash', 'TX_HASH']) expect(doorFor(c, h, base)).toBe(`${base}/tx/${h}`);
    // a v4 pool id, a block's hash, a topic, a message id, a note's text: not known to be a transaction
    for (const c of ['pool_id', 'block_hash', 'topic0', 'message_id', 'id', 'txs', '']) expect(doorFor(c, h, base)).toBeNull();
  });

  it('opens addresses, blocks and P-Chain ids by their value, in any column', () => {
    const a = `0x${'12'.repeat(20)}`;
    expect(doorFor('', a, base)).toBe(`${base}/address/${a}`);
    expect(doorFor('pool', a, base)).toBe(`${base}/address/${a}`);
    expect(doorFor('block_number', 123, base)).toBe(`${base}/block/123`);
    expect(doorFor('node_id', 'NodeID-7Xhw2mDxuDS44j42TCB6U5579esbSt3Lg', base)).toBe(`${base}/node/NodeID-7Xhw2mDxuDS44j42TCB6U5579esbSt3Lg`);
  });
});
