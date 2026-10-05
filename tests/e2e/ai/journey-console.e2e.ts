import { test } from '@e2e-dev/web';
import { expect } from 'e2e';
import { desktopOnly, needsModel } from '../lib/skip';
import { waitForHydration } from '../lib/hydration';
import { NAVIGATION_TIMEOUT, openAsReturningVisitor } from '../site/helpers';

// A visitor without a wallet opens a Console tool from the Console home. Each tool page checks the wallet
// later (ai/console-wallet-gate.e2e.ts), so these tests check only that the visitor reaches the tool.

// The Console home and sidebar link "Create L1" to /console/create-l1, the questionnaire flow.
test('visitor finds the tool to create an L1 from the Console home', async (fixtures) => {
  needsModel();
  const { app, agent, browser } = fixtures;
  await openAsReturningVisitor(app, browser, '/console');
  await desktopOnly(browser, 'site/console.e2e.ts tests the Console at both sizes');
  await waitForHydration(browser, '#nd-nav');
  await agent.act('find the tool to create a new Avalanche L1 and open it');
  await expect(browser).toHaveURL(/\/console\/create-l1(\/[\w-]+)?(\?|$)/, { timeout: NAVIGATION_TIMEOUT });
  // A missing page keeps its URL but shows the 404 page, so check the page title too.
  await expect(browser).toHaveTitle('Create L1 | Avalanche Builder Hub');
});

// The visitor names the need, not the tool. The faucet is the only tool that gives test AVAX on Fuji.
test('visitor finds where to get test AVAX from the Console home', async (fixtures) => {
  needsModel();
  const { app, agent, browser } = fixtures;
  await openAsReturningVisitor(app, browser, '/console');
  await desktopOnly(browser, 'site/console.e2e.ts tests the Console at both sizes');
  await waitForHydration(browser, '#nd-nav');
  await agent.act('find the tool that gives free test AVAX on the Fuji testnet and open it');
  await expect(browser).toHaveURL(/\/console\/primary-network\/faucet(\?|$)/, { timeout: NAVIGATION_TIMEOUT });
  await expect(browser).toHaveTitle('Testnet Faucet | Avalanche Builder Hub');
});
