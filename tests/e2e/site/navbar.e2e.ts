import { test } from '@e2e-dev/web';
import { expect } from 'e2e';
import { isPhoneLayout, phoneOnly } from '../lib/skip';
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
  test(`${menu} menu opens ${path}`, { timeout: TWO_ROUTE_TIMEOUT }, async ({ app, screen, browser }) => {
    await openAsReturningVisitor(app, browser, '/grants');
    const links = await openSiteMenu(screen, browser, menu);
    await links.getByRole('link', item).tap();
    await expect(browser).toHaveURL(path, { timeout: NAVIGATION_TIMEOUT });
    // A missing page keeps its URL but shows the 404 page, so check the page title too.
    await expect(browser).toHaveTitle(title);
  });
}

// Desktop: the Ecosystem trigger is itself a link. Phone: the Ecosystem header in the menu sheet is a link.
test('Ecosystem opens the ecosystem overview', { timeout: TWO_ROUTE_TIMEOUT }, async ({ app, screen, browser }) => {
  await openAsReturningVisitor(app, browser, '/grants');
  const area = (await isPhoneLayout(browser))
    ? await openSiteMenu(screen, browser, 'Ecosystem')
    : browser.locator('#nd-nav');
  await area.getByRole('link', 'Ecosystem').tap();
  await expect(browser).toHaveURL('/ecosystem', { timeout: NAVIGATION_TIMEOUT });
  await expect(browser).toHaveTitle('Ecosystem | Avalanche Builder Hub');
});

test('privacy banner leaves the end of the phone menu tappable', async ({ app, screen, browser }) => {
  await app.open('/grants');
  await phoneOnly(browser);
  await expect(screen.getByRole('button', 'Decline')).toBeVisible();
  const links = await openSiteMenu(screen, browser, 'Ecosystem');
  await links.getByRole('link', 'Integrations').tap({ timeout: 10_000 });
  await expect(browser).toHaveURL('/integrations', { timeout: NAVIGATION_TIMEOUT });
});
