import { test } from '@e2e-dev/web';
import { expect } from 'e2e';
import { phoneOnly } from '../lib/skip';
import { NAVIGATION_TIMEOUT, TWO_ROUTE_TIMEOUT, openAsReturningVisitor, openSiteMenu } from './helpers';

// One item of each top menu, and the page it must open.
// Desktop names a link by its label and its description, the phone sheet by its label only.
const MENU_ITEMS = [
  { menu: 'Solutions', item: /^Why Avalanche\b/, path: '/solutions', title: 'Solutions | Avalanche Builder Hub' },
  {
    menu: 'Developers',
    item: /^Documentation\b/,
    path: '/docs/primary-network',
    title: 'Primary Network | Avalanche Builder Hub',
  },
  {
    menu: 'Console',
    item: /^Testnet Faucet\b/,
    path: '/console/primary-network/faucet',
    title: 'Testnet Faucet | Avalanche Builder Hub',
  },
  {
    menu: 'Explorer',
    item: /^Validator Alerts\b/,
    path: '/validator-alerts',
    title: 'Validator Alerts | Avalanche Builder Hub',
  },
  { menu: 'Ecosystem', item: /^Integrations\b/, path: '/integrations', title: 'Integrations | Avalanche Builder Hub' },
];

for (const { menu, item, path, title } of MENU_ITEMS) {
  // One menu item is in the smoke set (tests/e2e/select): the navbar is on every page.
  const tags = menu === 'Developers' ? ['smoke'] : [];
  test(`${menu} menu opens ${path}`, { timeout: TWO_ROUTE_TIMEOUT, tags }, async ({ app, screen, browser }) => {
    await openAsReturningVisitor(app, browser, '/grants');
    const links = await openSiteMenu(screen, browser, menu);
    await links.getByRole('link', item).tap();
    await expect(browser).toHaveURL(path, { timeout: NAVIGATION_TIMEOUT });
    // A missing page keeps its URL but shows the 404 page, so check the page title too.
    await expect(browser).toHaveTitle(title);
  });
}

test('privacy banner leaves the end of the phone menu tappable', async ({ app, screen, browser }) => {
  await app.open('/grants');
  await phoneOnly(browser);
  await expect(screen.getByRole('button', 'Decline')).toBeVisible();
  const links = await openSiteMenu(screen, browser, 'Ecosystem');
  await links.getByRole('link', 'Integrations').tap({ timeout: 10_000 });
  await expect(browser).toHaveURL('/integrations', { timeout: NAVIGATION_TIMEOUT });
});
