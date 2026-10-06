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

// The phone sheet gives every section at least one picture card (components/navigation/nav-config.ts).
// A section with one card shows its text links in a column beside the card.
const PHONE_SECTIONS = ['Solutions', 'Developers', 'Console', 'Explorer', 'Ecosystem'];

test('phone menu shows a picture card in every section, and its links fit their column', async ({
  app,
  screen,
  browser,
}) => {
  await openAsReturningVisitor(app, browser, '/');
  await phoneOnly(browser);
  const sheet = await openSiteMenu(screen, browser, 'Solutions');
  for (const title of PHONE_SECTIONS) {
    // The Console card has the same name as the Console title. The title comes first.
    await expect(sheet.getByRole('link', title).first()).toBeVisible();
  }
  await expect(sheet.getByRole('link', 'Testnet Faucet')).toHaveAttribute('href', '/console/primary-network/faucet');

  // The sections have no landmark, so read them from the page: a section is the parent of its title link,
  // and a picture card is a link that holds an image.
  const sections = await browser.evaluate((titles: string[]) => {
    const links = [...document.querySelectorAll('[data-navbar-dropdown] a')];
    return titles.map((title) => {
      const heading = links.find((a) => !a.querySelector('img') && (a.textContent ?? '').trim() === title);
      const block = heading?.parentElement;
      const cards = block ? [...block.querySelectorAll('a')].filter((a) => a.querySelector('img')) : [];
      return { title, cards: cards.map((a) => a.getAttribute('href') ?? '') };
    });
  }, PHONE_SECTIONS);
  for (const { title, cards } of sections) expect(cards.length, `picture cards in ${title}`).toBeGreaterThan(0);
  expect(sections.find((section) => section.title === 'Console')?.cards).toContain('/console/primary-network/faucet');

  // A link wider than its column is cut off or pushes the sheet sideways. The labels beside a card do not wrap.
  const fit = await browser.evaluate(() => {
    const panel = document.querySelector('[data-navbar-dropdown] > div');
    if (!panel) return null;
    const label = (a: Element) => (a.textContent ?? '').trim();
    return {
      beside: [...panel.querySelectorAll('a:has(img) ~ div a')].map(label),
      tooWide: [...panel.querySelectorAll('a')].filter((a) => a.scrollWidth > a.clientWidth).map(label),
      scrollsSideways: panel.scrollWidth > panel.clientWidth,
    };
  });
  expect(fit, 'the open sheet').not.toBeNull();
  expect(fit!.beside.length, 'links in a column beside a card').toBeGreaterThan(0);
  expect(fit!.tooWide, 'links wider than their column').toEqual([]);
  expect(fit!.scrollsSideways, 'the sheet scrolls sideways').toBe(false);
});
