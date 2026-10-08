import { readFileSync } from 'node:fs';
import { test } from '@e2e-dev/web';
import { expect } from 'e2e';
import { z } from 'zod';
import { DATA, MULTI_PAGE, NAVIGATION, OVERVIEW_BLOCK_ROW, pathPattern } from '../explorer/explorer-page';
import { desktopOnly, needsModel } from '../lib/skip';
import { waitForHydration } from '../lib/hydration';
import { answerFirstVisitPrompts } from '../lib/visitor';

// A visitor opens the All Networks view, switches it to Fuji, then opens the City. Each view must show Fuji chains
// only. explorer/fuji-network-scope.e2e.ts checks the switch, the empty states and the chain menu with locators.
// This test gives the two moves in plain words, and the agent reads the chain names that each view shows.
//
// The live boards read the busiest chains that the Fuji catalog (constants/l1-chains.json) gives an RPC, so each
// board name is a Fuji catalog name. A board writes "C-Chain" for the catalog's "Avalanche (C-Chain)".
// The City lists every L1 of the Fuji P-Chain, with the name from the P-Chain feed, else the catalog, else a short
// ID. Many Fuji L1s are not in the catalog, so a City name can be in no catalog. A mainnet chain in the City shows
// as a name that only the mainnet catalog holds.

interface CatalogChain {
  chainName: string;
  isTestnet?: boolean;
}

test('visitor switches All Networks to Fuji and sees only Fuji chains there and in the City', MULTI_PAGE, async (fixtures) => {
  needsModel();
  const { app, agent, browser, screen } = fixtures;
  const catalog = JSON.parse(
    readFileSync(new URL('../../../constants/l1-chains.json', import.meta.url), 'utf8'),
  ) as CatalogChain[];
  const fujiNames = new Set(catalog.filter((c) => c.isTestnet === true).map((c) => c.chainName.trim()));
  const mainnetOnly = new Set(
    catalog
      .filter((c) => c.isTestnet !== true)
      .map((c) => c.chainName.trim())
      .filter((name) => !fujiNames.has(name)),
  );
  fujiNames.add('C-Chain');

  await app.open('/explorer/mainnet');
  await desktopOnly(browser, 'explorer/fuji-network-scope.e2e.ts tests the Fuji view and City at both sizes');
  await answerFirstVisitPrompts(browser);
  await app.open('/explorer/mainnet');
  await waitForHydration(browser, '#nd-nav');
  await agent.act('switch the All Networks explorer to the Fuji testnet');
  await expect(browser).toHaveURL(pathPattern('/explorer/fuji'), NAVIGATION);
  await expect(screen.getByRole('link', 'Fuji')).toHaveAttribute('aria-current', 'page');

  // The boards fill when the first read of each chain lands. A transaction row links its short hash.
  await expect(screen.getByRole('link', OVERVIEW_BLOCK_ROW).first()).toBeVisible(DATA);
  await expect(screen.getByRole('link', /^0x[\da-f]{4}…[\da-f]{4}$/).first()).toBeVisible(DATA);
  const boards = await agent.extract(
    'Read the "Latest Blocks" and the "Latest Transactions" boards. For each board, copy the chain name that each ' +
      'row shows in its Chain column, as the page writes it.',
    { schema: z.object({ latestBlocks: z.array(z.string()), latestTransactions: z.array(z.string()) }) },
  );
  expect(boards.latestBlocks.length).toBeGreaterThan(0);
  expect(boards.latestTransactions.length).toBeGreaterThan(0);
  const notFuji = [...boards.latestBlocks, ...boards.latestTransactions].filter((name) => !fujiNames.has(name.trim()));
  expect(notFuji).toEqual([]);

  await agent.act('open the City view');
  await expect(browser).toHaveURL(pathPattern('/explorer/fuji/chains'), NAVIGATION);
  const network = screen.getByRole('group', 'Network');
  await expect(network.getByText('Fuji')).toHaveAttribute('aria-current', 'page');
  await expect(network.getByRole('link', 'Mainnet')).toBeVisible();

  // The Chains door opens the sidebar list. The list has its own Network group, and the door's card leaves.
  await waitForHydration(browser, 'button[aria-controls="city-sidebar"]');
  const door = screen.getByRole('button', /^Chains/);
  await door.tap();
  await expect(door).toHaveAttribute('aria-expanded', 'true');
  const sidebar = screen.getByRole('complementary', 'Chains');
  await expect(sidebar.getByRole('group', 'Network').getByRole('link', 'Mainnet')).toBeVisible(DATA);
  const city = await agent.extract(
    'Read the list of chains in the open "Chains" sidebar. Copy the name of every chain that it lists, from the top ' +
      'to the bottom. Copy only the name: not the short grey code after a name that two chains share, not a badge, ' +
      'and not the figure at the end of the row.',
    { schema: z.object({ names: z.array(z.string()) }) },
  );
  const names = city.names.map((name) => name.trim());
  // The door shows the number of chains in the list. The agent must read the whole list, not only its first rows.
  const listed = Number(/\d+/.exec((await door.textContent()) ?? '')?.[0]);
  expect(listed).toBeGreaterThan(0);
  expect(names.length).toBeGreaterThanOrEqual(Math.floor(listed * 0.9));
  expect(names).toContain('C-Chain');
  expect(names.filter((name) => fujiNames.has(name)).length).toBeGreaterThan(1);
  expect(names.filter((name) => mainnetOnly.has(name))).toEqual([]);
});
