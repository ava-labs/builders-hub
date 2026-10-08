import { describe, expect, it } from 'vitest';
import { doorFor, fillTitle } from '@/components/explorer-v2/evm/QueryRows';

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

describe('fillTitle', () => {
  it('writes a time to the minute in UTC, and a day as its date', () => {
    expect(fillTitle('Largest fees in the hour from {{t}}', { t: '2026-09-29 15:00:00' }, {})).toBe('Largest fees in the hour from 2026-09-29 15:00 UTC');
    expect(fillTitle('Transactions in the 5 minutes from {{t}}', { t: '2026-09-28 10:05:30' }, {})).toBe('Transactions in the 5 minutes from 2026-09-28 10:05:30 UTC');
    expect(fillTitle('Largest fees on {{t}}', { t: '2026-09-24' }, {})).toBe('Largest fees on 2026-09-24');
  });

  it('names a value where the names know it, and cuts an address short', () => {
    const a = `0x${'12'.repeat(20)}`;
    expect(fillTitle('Calls to {{to_address:bytes}}', { to_address: a }, { to_address: { [a]: 'Pharaoh Router' } })).toBe('Calls to Pharaoh Router');
    expect(fillTitle('Calls to {{to_address}}', { to_address: a }, {})).toBe('Calls to 0x1212…1212');
    expect(fillTitle('Calls by {{missing}}', {}, {})).toBe('Calls by ?');
  });
});
