import { test } from '@e2e-dev/web';
import { expect } from 'e2e';
import { z } from 'zod';
import {
  CITY_TAP,
  DATA,
  MULTI_PAGE,
  NAVIGATION,
  OVERVIEW_BLOCK_ROW,
  catalogNames,
  namesOneOf,
  pathPattern,
  sectionTabs,
} from '../explorer/explorer-page';
import { desktopOnly, needsModel } from '../lib/skip';
import { waitForHydration } from '../lib/hydration';
import { answerFirstVisitPrompts } from '../lib/visitor';

// A visitor opens the All Networks view, switches it to Fuji, then opens the City. Each view must show Fuji chains
// only. explorer/fuji-network-scope.e2e.ts checks the switch, the empty states and the chain menu with locators.
// Here the agent makes the move to Fuji from plain words, and it reads the chain names on the boards.
// The City link and the City list use locators. @e2e-dev/web stops the page capture of an agent step after 15 s, and
// in CI the capture of the City page took longer than that. The cause in CI is inferred, not traced: CI draws the City
// with software WebGL, which holds the page's main thread for seconds at a time.
//
// The live boards read the busiest chains that the Fuji catalog (constants/l1-chains.json) gives an RPC, so each
// board name is a Fuji catalog name. A board writes "C-Chain" for the catalog's "Avalanche (C-Chain)".
// The City lists every L1 of the Fuji P-Chain, with the name from the P-Chain feed, else the catalog, else a short
// ID. Many Fuji L1s are not in the catalog, so a City name can be in no catalog. A mainnet chain in the City shows
// as a name that only the mainnet catalog holds.

test('visitor switches All Networks to Fuji and sees only Fuji chains there and in the City', MULTI_PAGE, async (fixtures) => {
  needsModel();
  const { app, agent, browser, screen } = fixtures;
  const { fuji, mainnetOnly } = catalogNames();
  fuji.add('C-Chain');

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
  const notFuji = [...boards.latestBlocks, ...boards.latestTransactions].filter((name) => !fuji.has(name.trim()));
  expect(notFuji).toEqual([]);

  // The tap's last check runs on the page that starts to build the City, so the tap gets the City tap budget.
  await sectionTabs(screen).getByRole('link', 'City').tap(CITY_TAP);
  await expect(browser).toHaveURL(pathPattern('/explorer/fuji/chains'), NAVIGATION);
  const network = screen.getByRole('group', 'Network');
  await expect(network.getByText('Fuji')).toHaveAttribute('aria-current', 'page');
  await expect(network.getByRole('link', 'Mainnet')).toBeVisible();

  // The Chains door opens the sidebar list. The list has its own Network group, and the door's card leaves.
  await waitForHydration(browser, 'button[aria-controls="city-sidebar"]');
  const door = screen.getByRole('button', /^Chains/);
  await door.tap(CITY_TAP);
  await expect(door).toHaveAttribute('aria-expanded', 'true');
  const sidebar = screen.getByRole('complementary', 'Chains');
  await expect(sidebar.getByRole('group', 'Network').getByRole('link', 'Mainnet')).toBeVisible(DATA);
  // The door shows the number of chains in the list, and a feed update can change both. Each read takes the door and
  // the rows together, and the poll ends at a read where the two counts agree.
  const rows = sidebar.getByRole('listitem');
  let texts: string[] = [];
  const doorAndRows = async () => {
    const listed = /\d+/.exec((await door.textContent()) ?? '')?.[0];
    texts = await rows.allTextContents();
    return `door ${listed}, rows ${texts.length}`;
  };
  await expect.poll(doorAndRows, DATA).toMatch(/^door ([1-9]\d*), rows \1$/);
  const cChain = texts.filter((text) => namesOneOf(text, new Set(['C-Chain'])));
  const catalogued = texts.filter((text) => namesOneOf(text, fuji));
  const mainnet = texts.filter((text) => !namesOneOf(text, fuji) && namesOneOf(text, mainnetOnly));
  expect(cChain.length, 'rows that name the C-Chain').toBeGreaterThan(0);
  expect(catalogued.length, 'rows that name a Fuji catalog chain').toBeGreaterThan(1);
  expect(mainnet, 'rows that name a mainnet-only chain').toEqual([]);
});
