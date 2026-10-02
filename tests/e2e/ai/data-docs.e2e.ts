import { test } from '@e2e-dev/web';
import { expect } from 'e2e';
import { z } from 'zod';
import { openDocsPage } from '../docs/docs-page';
import { desktopOnly, knownBug, needsModel } from '../lib/skip';

// Data tests: the agent reads facts off a page, and plain code compares them with the known truth.
// One extract per test, because extract calls the model on every run (the replay cache covers act only).

const network = z.object({
  chainId: z.number().int().describe('the chain ID in decimal'),
  chainIdHex: z.string().describe('the chain ID in hex, as the page writes it'),
  rpcUrl: z.string().describe('the RPC URL'),
});
const rpcPair = z.object({ mainnet: z.string(), fuji: z.string() });

// The truth: the C-Chain chain IDs (eth_chainId) and the public API endpoints of the Primary Network.
test('primary network docs list the right chain IDs and RPC URLs', async (fixtures) => {
  needsModel();
  const { app, agent, browser } = fixtures;
  await openDocsPage(app, browser, '/docs/primary-network');
  await desktopOnly(browser, 'the facts are the same at both sizes');
  const facts = await agent.extract(
    'From the property tables of the C-Chain, P-Chain and X-Chain sections, read the Mainnet and Fuji Testnet values: ' +
      'for the C-Chain the chain ID in decimal, the chain ID in hex and the RPC URL; for the P-Chain and the X-Chain the RPC URL. ' +
      'Copy each value as the page shows it.',
    {
      schema: z.object({
        cChain: z.object({ mainnet: network, fuji: network }),
        pChainRpc: rpcPair,
        xChainRpc: rpcPair,
      }),
    },
  );
  // The page writes the hex in capitals (0xA86A). Case is not the fact under test.
  facts.cChain.mainnet.chainIdHex = facts.cChain.mainnet.chainIdHex.toLowerCase();
  facts.cChain.fuji.chainIdHex = facts.cChain.fuji.chainIdHex.toLowerCase();
  expect(facts).toEqual({
    cChain: {
      mainnet: { chainId: 43114, chainIdHex: '0xa86a', rpcUrl: 'https://api.avax.network/ext/bc/C/rpc' },
      fuji: { chainId: 43113, chainIdHex: '0xa869', rpcUrl: 'https://api.avax-test.network/ext/bc/C/rpc' },
    },
    pChainRpc: { mainnet: 'https://api.avax.network/ext/bc/P', fuji: 'https://api.avax-test.network/ext/bc/P' },
    xChainRpc: { mainnet: 'https://api.avax.network/ext/bc/X', fuji: 'https://api.avax-test.network/ext/bc/X' },
  });
});

// net_version returns the networkID. Coreth sets it to the chain ID (avalanchego graft/coreth/plugin/evm/vm.go:333,
// vm.ethConfig.NetworkId = vm.chainID.Uint64()), so the C-Chain answers 43114 on Mainnet and 43113 on Fuji.
test('C-Chain RPC docs state the right networkID and chainID', async (fixtures) => {
  knownBug(
    'content/docs/rpcs/c-chain/index.mdx:7 (synced from avalanchego graft/coreth/plugin/evm/service.md:6 by ' +
      'utils/remote-content/apis.mts:59) says the C-Chain networkID is 1; net_version returns the chain ID',
  );
  needsModel();
  const { app, agent, browser } = fixtures;
  await openDocsPage(app, browser, '/docs/rpcs/c-chain');
  await desktopOnly(browser, 'the facts are the same at both sizes');
  const ids = z.object({ networkId: z.number().int(), chainId: z.number().int() });
  const facts = await agent.extract(
    'From the note at the top of the page, read the Ethereum networkID and chainID that the C-Chain uses on Mainnet and on the Fuji Testnet.',
    { schema: z.object({ mainnet: ids, fuji: ids }) },
  );
  expect(facts).toEqual({ mainnet: { networkId: 43114, chainId: 43114 }, fuji: { networkId: 43113, chainId: 43113 } });
});
