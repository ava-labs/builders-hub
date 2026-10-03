import { test } from '@e2e-dev/web';
import { expect } from 'e2e';
import { desktopOnly, needsModel, phoneOnly } from '../lib/skip';
import { NAVIGATION_TIMEOUT, TWO_ROUTE_TIMEOUT, openAsReturningVisitor } from '../site/helpers';
import { waitForHydration } from '../lib/hydration';

// The visitor names a topic, not a menu item. The agent finds the way through the navbar menus.
// The Interchain Messaging docs are at /docs/cross-chain. The Console menu item "Interchain Messaging Tools"
// (/console/icm/setup) is a tool, not documentation, so the URL check fails if the agent takes it.
test('site navigation leads from the home page to the Interchain Messaging docs', { timeout: TWO_ROUTE_TIMEOUT }, async (fixtures) => {
  needsModel();
  const { app, agent, browser } = fixtures;
  await openAsReturningVisitor(app, browser, '/');
  await desktopOnly(browser, 'the phone menu has its own test below');
  await waitForHydration(browser, '#nd-nav');
  await agent.act('use the site navigation to open the Interchain Messaging documentation');
  await expect(browser).toHaveURL(/\/docs\/cross-chain(\/|$)/, { timeout: NAVIGATION_TIMEOUT });
});

test('phone menu leads from the home page to the Explorer', { timeout: TWO_ROUTE_TIMEOUT }, async (fixtures) => {
  needsModel();
  const { app, agent, browser } = fixtures;
  // A returning visitor has answered the privacy banner. site/navbar.e2e.ts tests the menu under the banner.
  await openAsReturningVisitor(app, browser, '/');
  await phoneOnly(browser);
  await waitForHydration(browser, '#nd-nav');
  await agent.act('open the menu and go to the Explorer');
  await expect(browser).toHaveURL(/\/explorer(\/|$)/, { timeout: NAVIGATION_TIMEOUT });
});
