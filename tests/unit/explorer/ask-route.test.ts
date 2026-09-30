import { describe, expect, it } from 'vitest';

import l1ChainsData from '@/constants/l1-chains.json';
import type { Node } from '@/components/explorer-v2/network/icm-map';
import { askChainsOf, queryHref, routeFor, scopeOf, sentOf, towerOfRow, towerOfValue, towersOf } from '@/components/explorer-v2/network/ask-route';
import { toHexBytes } from '@/lib/explorer-query/pchain-ids';
import type { L1Chain } from '@/types/stats';

const chains = askChainsOf(l1ChainsData as L1Chain[]);
const beam = chains.find((c) => c.slug === 'beam')!;
const route = (q: string, picked: string | null = null) => {
  const r = routeFor(q, picked, chains);
  return r.for ? `${r.on} for ${r.for}` : r.on;
};

describe('routeFor', () => {
  it('asks the chain a question names, the C-Chain and the P-Chain by name, an L1 by its catalog name', () => {
    expect(route('USDC transfers on the C-Chain', 'beam')).toBe('c-chain');
    expect(route('P-Chain transactions by type this week', 'beam')).toBe('p-chain');
    expect(route('Daily transactions on Beam over the last 30 days')).toBe('beam');
  });

  it('names no L1 with a lowercase common word', () => {
    expect(route('are fees even across blocks')).toBe('c-chain');
  });

  it('sends a P-Chain topic to the P-Chain, before the chain picked in the city', () => {
    expect(route('L1s by active validators, with the balance left for fees')).toBe('p-chain');
    expect(route('validators over time', 'c-chain')).toBe('p-chain');
    expect(route('fee balance of each L1')).toBe('p-chain');
  });

  it('scopes a P-Chain question to the picked L1, or to an L1 it names', () => {
    expect(route('who validates this chain', 'beam')).toBe('p-chain for beam');
    expect(route('Delegations per day, with AVAX delegated', 'dexalot')).toBe('p-chain for dexalot');
    expect(route('Beam validators by weight')).toBe('p-chain for beam');
    expect(route('who validates this chain')).toBe('p-chain');
  });

  it('keeps gas fees and token balances off the P-Chain', () => {
    expect(route('Fees burned per 5 minutes')).toBe('c-chain');
    expect(route('USDC balance of the top holders')).toBe('c-chain');
  });

  it('asks the picked chain, else the C-Chain', () => {
    expect(route('Daily transactions over the last 30 days', 'beam')).toBe('beam');
    expect(route('Fees burned per 5 minutes', 'beam')).toBe('beam');
    expect(route('Most called methods', 'p-chain')).toBe('p-chain');
    expect(route('Busiest senders in the last hour')).toBe('c-chain');
  });
});

describe('the scope a P-Chain question carries', () => {
  const thread = { q: 'who validates this chain', then: [], on: 'p-chain', for: 'beam' };

  it('rides after the mark the Query page hides, as CB58 and as bytes', () => {
    expect(sentOf(thread.q, beam)).toBe(`who validates this chain\n\n(Only the rows where subnet_id is ${beam.subnetId}, the bytes unhex('${toHexBytes(beam.subnetId!)}').)`);
    expect(sentOf(thread.q, null)).toBe(thread.q);
  });

  it('applies to P-Chain threads only', () => {
    expect(scopeOf(thread, chains)?.slug).toBe('beam');
    expect(scopeOf({ ...thread, on: 'c-chain' }, chains)).toBeNull();
  });

  it('opens on the Query page with the question as the engine read it', () => {
    const href = queryHref(thread, chains);
    expect(href.startsWith('/explorer/mainnet/query?chain=p-chain&q=who%20validates%20this%20chain%0A%0A%28Only%20the%20rows%20where')).toBe(true);
    expect(queryHref({ q: 'Busiest senders', then: ['only reverted'], on: 'c-chain' }, chains)).toBe('/explorer/mainnet/query?chain=c-chain&q=Busiest%20senders&then=only%20reverted');
    expect(queryHref({ q: 'Daily transactions', then: [], on: 'beam' }, chains)).toBe('/explorer/mainnet/beam/query?q=Daily%20transactions');
  });
});

describe('the towers an answer names', () => {
  const node = (o: Partial<Node>) => ({ guest: false, subnetId: null, blockchainId: null, ...o }) as Node;
  const guestSubnet = '2DeHa7Qb6sufPkmQcFWG2uCd4pBPv9WB6dkzroiMQhd1NSRtof';
  const towers = towersOf([node({ id: '4337', subnetId: beam.subnetId }), node({ id: `p:${guestSubnet}`, guest: true, subnetId: guestSubnet })]);

  it('finds a tower by its subnet ID, as CB58 or as hex, in any column', () => {
    expect(towerOfValue(towers, 'subnet_id', beam.subnetId)).toBe('4337');
    expect(towerOfValue(towers, 'anything', `0x${toHexBytes(beam.subnetId!)}`)).toBe('4337');
    expect(towerOfValue(towers, 'subnet_id', guestSubnet)).toBe(`p:${guestSubnet}`);
  });

  it('reads an EVM chain ID only in a column named for one', () => {
    expect(towerOfValue(towers, 'chain_id', 4337)).toBe('4337');
    expect(towerOfValue(towers, 'destination_chain', '4337')).toBe('4337');
    expect(towerOfValue(towers, 'txs', 4337)).toBeNull();
  });

  it('prefers the column asked for, then any column of the row', () => {
    expect(towerOfRow(towers, { node_id: 'NodeID-x', subnet_id: beam.subnetId }, 'node_id')).toBe('4337');
    expect(towerOfRow(towers, { t: '2026-09-26', txs: 4337 })).toBeNull();
  });
});
