import { test } from '@e2e-dev/web';
import { expect } from 'e2e';
import { MULTI_PAGE, NAVIGATION, expectActiveTab } from '../explorer/explorer-page';
import { desktopOnly, needsModel } from '../lib/skip';
import { waitForHydration } from '../lib/hydration';

// Two steps in one sentence: the network switch, then a tab. explorer/network-switch.e2e.ts checks each
// switch target with locators. This test checks that a visitor finds both controls from plain words.
test('visitor switches the C-Chain explorer to Fuji and opens its blocks list', MULTI_PAGE, async (fixtures) => {
  needsModel();
  const { app, agent, browser, screen } = fixtures;
  await app.open('/explorer/mainnet/c-chain');
  await desktopOnly(browser, 'explorer/network-switch.e2e.ts tests the switch at both sizes');
  await waitForHydration(browser, '#nd-nav');
  await agent.act('switch the explorer to the Fuji testnet, then open the list of blocks');
  await expect(browser).toHaveURL(/\/explorer\/fuji\/c-chain\/blocks(\?|$)/, NAVIGATION);
  await expectActiveTab(screen, browser, 'Blocks');
  await expect(screen.getByRole('link', 'Fuji')).toHaveAttribute('aria-current', 'page');
});
