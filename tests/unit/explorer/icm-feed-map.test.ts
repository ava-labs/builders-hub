import { describe, expect, it } from 'vitest';

import { mapStatsFeedPage, weiToEther, type StatsFeedPage } from '@/lib/icm-feed-map';

/* Real values from the C-Chain feed. Henesys is a chain we do NOT index, which
   is the ordinary case for a counterparty, and its catalog entry stores the
   blockchain ID as hex while the API reports CB58. */
const C_CHAIN_HEX = '0xd32cc4660bcf8fa7971589f666fddb5ab22aee7e75dcb30b19829a65d4fb0063';
const HENESYS_CB58 = '2LFmzhHDKxkreihEtPanVmofuFn63bsh8twnRXEbDhBtCJxURB';
const HENESYS_HEX = '0xaf6a974f467006d94388f438014162dd12ec2d1475c48faf09ffe7222d59e478';

function page(over: Partial<StatsFeedPage['messages'][number]>): StatsFeedPage {
  return {
    chainId: 43114,
    messages: [
      {
        hash: '0xc98dc5df',
        from: '0xcf0c7a14',
        to: '0x253b2784',
        value: '0',
        blockNumber: 95175266,
        timestamp: 1789297026,
        direction: 'in',
        counterpartyBlockchainId: HENESYS_CB58,
        ...over,
      },
    ],
    nextBeforeBlock: 95175265,
    exhausted: false,
  };
}

describe('mapStatsFeedPage direction', () => {
  // A receive means this chain is the DESTINATION. Getting this backwards would
  // draw every arrow on the page the wrong way round and still look plausible.
  it('puts the counterparty on the source side for an incoming message', () => {
    const [m] = mapStatsFeedPage(page({ direction: 'in' }), C_CHAIN_HEX).messages;
    expect(m.sourceBlockchainId).toBe(HENESYS_HEX);
    expect(m.destinationBlockchainId).toBe(C_CHAIN_HEX);
  });

  it('puts this chain on the source side for an outgoing message', () => {
    const [m] = mapStatsFeedPage(page({ direction: 'out' }), C_CHAIN_HEX).messages;
    expect(m.sourceBlockchainId).toBe(C_CHAIN_HEX);
    expect(m.destinationBlockchainId).toBe(HENESYS_HEX);
  });
});

describe('mapStatsFeedPage identifiers', () => {
  // The API speaks CB58, l1-chains.json stores hex for 232 of 233 entries. Pass
  // CB58 straight through and every counterparty renders as "unknown".
  it('converts the counterparty from CB58 to the hex the catalog matches on', () => {
    const [m] = mapStatsFeedPage(page({}), C_CHAIN_HEX).messages;
    expect(m.sourceBlockchainId).toBe(HENESYS_HEX);
    expect(m.sourceBlockchainId).not.toContain(HENESYS_CB58);
  });

  it('leaves the far side undefined when the API reported no counterparty', () => {
    const [m] = mapStatsFeedPage(page({ counterpartyBlockchainId: undefined }), C_CHAIN_HEX).messages;
    expect(m.sourceBlockchainId).toBeUndefined();
    expect(m.destinationBlockchainId).toBe(C_CHAIN_HEX);
  });

  it('carries a null `to` rather than dropping the field', () => {
    const [m] = mapStatsFeedPage(page({ to: undefined }), C_CHAIN_HEX).messages;
    expect(m.to).toBeNull();
  });
});

describe('mapStatsFeedPage shapes', () => {
  // The RPC path emits an ISO string and six decimal places; the row component
  // reads one shape, so the two sources must not drift apart.
  it('matches the RPC path: ISO timestamp and six-decimal value', () => {
    const [m] = mapStatsFeedPage(page({ value: '900000000000000' }), C_CHAIN_HEX).messages;
    expect(m.timestamp).toBe(new Date(1789297026 * 1000).toISOString());
    expect(m.value).toBe('0.000900');
    expect(m.blockNumber).toBe('95175266');
    expect(m.isCrossChain).toBe(true);
  });

  it('carries the cursor and exhaustion through unchanged', () => {
    const out = mapStatsFeedPage(page({}), C_CHAIN_HEX);
    expect(out.status).toBe('ok');
    expect(out.nextBeforeBlock).toBe(95175265);
    expect(out.exhausted).toBe(false);
  });

  it('handles an empty page', () => {
    const out = mapStatsFeedPage(
      { chainId: 43114, messages: [], nextBeforeBlock: null, exhausted: true },
      C_CHAIN_HEX,
    );
    expect(out.messages).toEqual([]);
    expect(out.nextBeforeBlock).toBeNull();
    expect(out.exhausted).toBe(true);
  });
});

describe('weiToEther', () => {
  it('formats wei the way the RPC path does', () => {
    expect(weiToEther('0')).toBe('0.000000');
    expect(weiToEther('900000000000000')).toBe('0.000900');
    expect(weiToEther('1000000000000000000')).toBe('1.000000');
  });

  // A malformed value must not take the whole page down with it.
  it('falls back to zero on a value it cannot parse', () => {
    expect(weiToEther('not-a-number')).toBe('0.000000');
    expect(weiToEther('')).toBe('0.000000');
  });
});
