import { describe, expect, it } from 'vitest';

import { switchTarget } from '@/components/explorer-v2/network-switch';

/* The Mainnet/Fuji switch keeps the page the reader is on when the other
   network has its tab. The rows mirror the CASES table of
   tests/e2e/explorer/network-switch.e2e.ts. The switch reads the path
   without its query string (usePathname), so ?q=ava is not here. Its rules
   are the chain switch's too: tests/unit/explorer/chain-switch.test.ts. */

// The switch from a page: the chain is the URL's chain segment in every row here.
const networkSwitch = (from: string, network: string, slug: string) => switchTarget(from, from.split('/')[3], network, slug);

type Row = [from: string, network: string, slug: string, expected: string];

const CASES: Row[] = [
  // Mainnet to Fuji, EVM chains
  ['/explorer/mainnet/c-chain', 'fuji', 'c-chain', '/explorer/fuji/c-chain'],
  ['/explorer/mainnet/c-chain/blocks', 'fuji', 'c-chain', '/explorer/fuji/c-chain/blocks'],
  ['/explorer/mainnet/c-chain/txs', 'fuji', 'c-chain', '/explorer/fuji/c-chain/txs'],
  ['/explorer/mainnet/c-chain/gas', 'fuji', 'c-chain', '/explorer/fuji/c-chain/gas'],
  ['/explorer/mainnet/c-chain/gas/base-fee', 'fuji', 'c-chain', '/explorer/fuji/c-chain/gas/base-fee'],
  ['/explorer/mainnet/c-chain/validators', 'fuji', 'c-chain', '/explorer/fuji/c-chain/validators'],
  ['/explorer/mainnet/c-chain/accounts', 'fuji', 'c-chain', '/explorer/fuji/c-chain/accounts'],
  // DeFi is mainnet only, so the switch lands on the chain home
  ['/explorer/mainnet/c-chain/defi', 'fuji', 'c-chain', '/explorer/fuji/c-chain'],
  // Beam's Fuji slug is beam-l1
  ['/explorer/mainnet/beam/blocks', 'fuji', 'beam-l1', '/explorer/fuji/beam-l1/blocks'],

  // Mainnet to Fuji, P-Chain and X-Chain
  ['/explorer/mainnet/p-chain', 'fuji', 'p-chain', '/explorer/fuji/p-chain'],
  ['/explorer/mainnet/p-chain/blocks', 'fuji', 'p-chain', '/explorer/fuji/p-chain/blocks'],
  ['/explorer/mainnet/p-chain/txs', 'fuji', 'p-chain', '/explorer/fuji/p-chain/txs'],
  ['/explorer/mainnet/p-chain/validators', 'fuji', 'p-chain', '/explorer/fuji/p-chain/validators'],
  ['/explorer/mainnet/p-chain/validators/l1s', 'fuji', 'p-chain', '/explorer/fuji/p-chain/validators/l1s'],
  // Fuji has no Staking or L1s tab, and those Fuji routes redirect to the validators list
  ['/explorer/mainnet/p-chain/staking', 'fuji', 'p-chain', '/explorer/fuji/p-chain/validators'],
  ['/explorer/mainnet/p-chain/l1s', 'fuji', 'p-chain', '/explorer/fuji/p-chain/validators'],
  ['/explorer/mainnet/x-chain/blocks', 'fuji', 'x-chain', '/explorer/fuji/x-chain/blocks'],
  ['/explorer/mainnet/x-chain/txs', 'fuji', 'x-chain', '/explorer/fuji/x-chain/txs'],

  // Fuji to Mainnet
  ['/explorer/fuji/c-chain/blocks', 'mainnet', 'c-chain', '/explorer/mainnet/c-chain/blocks'],
  ['/explorer/fuji/c-chain/txs', 'mainnet', 'c-chain', '/explorer/mainnet/c-chain/txs'],
  ['/explorer/fuji/c-chain/gas', 'mainnet', 'c-chain', '/explorer/mainnet/c-chain/gas'],
  ['/explorer/fuji/c-chain/accounts', 'mainnet', 'c-chain', '/explorer/mainnet/c-chain/accounts'],
  ['/explorer/fuji/beam-l1/blocks', 'mainnet', 'beam', '/explorer/mainnet/beam/blocks'],
  ['/explorer/fuji/p-chain/blocks', 'mainnet', 'p-chain', '/explorer/mainnet/p-chain/blocks'],
  ['/explorer/fuji/p-chain/validators', 'mainnet', 'p-chain', '/explorer/mainnet/p-chain/validators'],
  ['/explorer/fuji/x-chain/txs', 'mainnet', 'x-chain', '/explorer/mainnet/x-chain/txs'],
];

/* An entity's id means nothing on the other network, so its page lands on its tab's list. */
const ENTITIES: Row[] = [
  ['/explorer/mainnet/c-chain/block/123', 'fuji', 'c-chain', '/explorer/fuji/c-chain/blocks'],
  ['/explorer/mainnet/c-chain/tx/0xabc123', 'fuji', 'c-chain', '/explorer/fuji/c-chain/txs'],
  ['/explorer/mainnet/c-chain/atomic-tx/2ViccB', 'fuji', 'c-chain', '/explorer/fuji/c-chain/txs'],
  ['/explorer/mainnet/c-chain/address/0xabc123', 'fuji', 'c-chain', '/explorer/fuji/c-chain'],
  ['/explorer/fuji/beam-l1/block/123', 'mainnet', 'beam', '/explorer/mainnet/beam/blocks'],
  ['/explorer/mainnet/p-chain/block/123', 'fuji', 'p-chain', '/explorer/fuji/p-chain/blocks'],
  ['/explorer/mainnet/p-chain/tx/2ViccBvY1J', 'fuji', 'p-chain', '/explorer/fuji/p-chain/txs'],
  ['/explorer/mainnet/p-chain/address/P-avax1abc', 'fuji', 'p-chain', '/explorer/fuji/p-chain'],
  ['/explorer/mainnet/p-chain/node/NodeID-7Xhw2mDxuDS44j42TCB6U5579esbSt3Lg', 'fuji', 'p-chain', '/explorer/fuji/p-chain/validators'],
  ['/explorer/fuji/x-chain/tx/2ViccBvY1J', 'mainnet', 'x-chain', '/explorer/mainnet/x-chain/txs'],
  // a board is kept per network, so its page lands on the boards list
  ['/explorer/mainnet/c-chain/query/boards/b-123', 'fuji', 'c-chain', '/explorer/fuji/c-chain/query/boards'],
];

describe('the Mainnet/Fuji switch', () => {
  it.each(CASES)('switches %s to %s %s: %s', (from, network, slug, expected) => {
    expect(networkSwitch(from, network, slug)).toBe(expected);
  });

  it.each(ENTITIES)('switches the entity page %s to %s %s: %s', (from, network, slug, expected) => {
    expect(networkSwitch(from, network, slug)).toBe(expected);
  });

  it('links the active network to the page the reader is on', () => {
    expect(networkSwitch('/explorer/mainnet/c-chain/defi', 'mainnet', 'c-chain')).toBe('/explorer/mainnet/c-chain/defi');
    expect(networkSwitch('/explorer/mainnet/p-chain/staking', 'mainnet', 'p-chain')).toBe('/explorer/mainnet/p-chain/staking');
  });
});
