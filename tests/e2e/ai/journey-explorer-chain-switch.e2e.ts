import { test } from '@e2e-dev/web';
import { expect } from 'e2e';
import { MULTI_PAGE, NAVIGATION, expectActiveTab, pathPattern } from '../explorer/explorer-page';
import { needsModel } from '../lib/skip';
import { waitForHydration } from '../lib/hydration';

// The chain switcher keeps the tab. explorer/chain-switch.e2e.ts checks its targets with locators. This test gives
// the task in plain words and names no control, so it fails when a visitor cannot find or use the switcher.
// It runs at both sizes because the phone switcher is in the site navbar, not in the tab rail as on wider screens.
test('visitor switches from the C-Chain blocks page to the P-Chain and stays on its blocks', MULTI_PAGE, async (fixtures) => {
  needsModel();
  const { app, agent, browser, screen } = fixtures;
  await app.open('/explorer/mainnet/c-chain/blocks');
  await waitForHydration(browser, '[data-explorer-subnav] button[aria-haspopup]');
  await agent.act('switch the explorer from the C-Chain to the P-Chain');
  await expect(browser).toHaveURL(pathPattern('/explorer/mainnet/p-chain/blocks'), NAVIGATION);
  await expectActiveTab(screen, browser, 'Blocks');
});
