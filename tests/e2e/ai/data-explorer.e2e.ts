import { test } from '@e2e-dev/web';
import { expect } from 'e2e';
import { z } from 'zod';
import { DATA } from '../explorer/explorer-page';
import { desktopOnly, needsModel } from '../lib/skip';

// Data tests: the agent reads facts off a page, and plain code compares them with the known truth.
// Explorer data is live, so these read only facts that never change: chain identity and past blocks.

// The chain record at the foot of a C-Chain overview (components/explorer/EvmChainDetails.tsx).
const CHAINS = [
  { network: 'mainnet', chainId: 43114, chainIdHex: '0xa86a' },
  { network: 'fuji', chainId: 43113, chainIdHex: '0xa869' },
] as const;

for (const chain of CHAINS) {
  test(`${chain.network} c-chain overview shows the chain ID ${chain.chainId}`, async (fixtures) => {
    needsModel();
    const { app, agent, browser, screen } = fixtures;
    await app.open(`/explorer/${chain.network}/c-chain`);
    await desktopOnly(browser, 'the facts are the same at both sizes');
    await expect(screen.getByText('EVM Chain ID')).toBeVisible(DATA);
    const facts = await agent.extract(
      'From the chain record near the bottom of the page, read the EVM chain ID in decimal and in hex, ' +
        'and the native token symbol and its number of decimals. Copy each value as the page shows it.',
      {
        schema: z.object({
          chainId: z.number().int(),
          chainIdHex: z.string(),
          tokenSymbol: z.string(),
          tokenDecimals: z.number().int(),
        }),
      },
    );
    expect({ ...facts, chainIdHex: facts.chainIdHex.toLowerCase() }).toEqual({
      chainId: chain.chainId,
      chainIdHex: chain.chainIdHex,
      tokenSymbol: 'AVAX',
      tokenDecimals: 18,
    });
  });
}

// Two past mainnet blocks. Block 0 is the C-Chain genesis: its hash is the network's well-known genesis hash.
// Block 96532775 is an ordinary block with 4 transactions: the agent reads the whole page, and every listed
// transaction adds to the cost. Its values come from eth_getBlockByNumber (2026-10-02), not from this page;
// an accepted block never changes.
const ZERO_HASH = `0x${'0'.repeat(64)}`;
const BLOCKS = [
  {
    number: 0,
    hash: '0x31ced5b9beb7f8782b014660da0cb18cc409f121f408186886e1ca3e8eeca96b',
    parentHash: ZERO_HASH,
    timestamp: 0,
    transactions: 0,
    gasLimit: 100_000_000,
  },
  {
    number: 96532775,
    hash: '0x02c689a396a990ac0acfbcfcce9b4ed52bf41f1b9d1d8aa3d0540c6631de0dbc',
    parentHash: '0x7b4d6fe2273b707d70adcd81d2bfb24f08eb1b13abcc54965ae756636ac1d9fc',
    timestamp: 1790861618,
    transactions: 4,
    gasLimit: 80_000_000,
  },
] as const;

for (const block of BLOCKS) {
  test(`mainnet c-chain block ${block.number} shows its hash, parent and header values`, async (fixtures) => {
    needsModel();
    const { app, agent, browser, screen } = fixtures;
    await app.open(`/explorer/mainnet/c-chain/block/${block.number}`);
    await desktopOnly(browser, 'the facts are the same at both sizes');
    // The header fields load from the RPC after the page renders.
    await expect(screen.getByText('Gas Limit')).toBeVisible(DATA);
    const facts = await agent.extract(
      'From the block details, read the full block hash, the full parent hash, the timestamp in unix seconds, ' +
        'the number of transactions in the block and the gas limit, as plain numbers without separators.',
      {
        schema: z.object({
          hash: z.string(),
          parentHash: z.string(),
          timestamp: z.number().int(),
          transactions: z.number().int(),
          gasLimit: z.number().int(),
        }),
      },
    );
    const { number: _number, ...truth } = block;
    expect({ ...facts, hash: facts.hash.toLowerCase(), parentHash: facts.parentHash.toLowerCase() }).toEqual(truth);
  });
}
