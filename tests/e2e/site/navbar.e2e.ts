import { test } from '@e2e-dev/web';
import type { Browser } from '@e2e-dev/web';
import { expect } from 'e2e';
import { desktopOnly, isPhoneLayout, phoneOnly } from '../lib/skip';
import { waitForHydration } from '../lib/hydration';
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

// site-mega-menu (app/global.css): the desktop menus run on transitions, so a pointer that sweeps across the triggers
// retargets each menu from where it is: one steady panel. Radix unmounts a closing panel when its exit animation (a
// 120ms hold) ends. A menu closed from the keyboard ends that hold at once, also when the key comes in the middle of a
// close the pointer started; a closing panel takes no pointer.

/** The open panel under the navbar: the Radix NavigationMenu viewport. */
const MENU_PANEL = '#nd-nav > :last-child > div';

/** The centre of a navbar trigger, by its name. */
async function triggerCentre(browser: Browser, name: string) {
  const box = await browser.locator('#nd-nav').getByRole('button', name).boundingBox();
  expect(box, `the ${name} trigger`).not.toBeNull();
  return { x: box!.x + box!.width / 2, y: box!.y + box!.height / 2 };
}

const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

test('a rapid pointer sweep across the menus leaves one steady panel', async ({ app, browser }) => {
  await openAsReturningVisitor(app, browser, '/grants');
  await desktopOnly(browser, 'the menu panel is the desktop navbar');
  await waitForHydration(browser, '#nd-nav nav button[aria-controls]');
  const names = ['Solutions', 'Developers', 'Console', 'Explorer', 'Ecosystem'];
  const centres = Object.fromEntries(await Promise.all(names.map(async (n) => [n, await triggerCentre(browser, n)])));

  await browser.mouse.move(0, 0);
  await browser.mouse.move(centres.Solutions.x, centres.Solutions.y);
  await expect(browser.locator(MENU_PANEL)).toHaveAttribute('data-state', 'open');
  await pause(500);

  // On every frame from here: the lowest panel opacity, the most panels mounted, and frames with a closed panel.
  await browser.evaluate((panel) => {
    const seen = { lowest: 1, most: 0, closedFrames: 0, stop: false };
    (window as unknown as { __e2eSweep: typeof seen }).__e2eSweep = seen;
    const frame = () => {
      const panels = [...document.querySelectorAll(panel)];
      seen.most = Math.max(seen.most, panels.length);
      for (const node of panels) {
        seen.lowest = Math.min(seen.lowest, Number(getComputedStyle(node).opacity));
        if (node.getAttribute('data-state') === 'closed') seen.closedFrames++;
      }
      if (!seen.stop) requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
    return null;
  }, MENU_PANEL);
  // Across to Ecosystem and back, ending on Console, with no pause on the way.
  for (const name of ['Developers', 'Console', 'Explorer', 'Ecosystem', 'Explorer', 'Console']) {
    await browser.mouse.move(centres[name].x, centres[name].y);
  }
  await pause(700);
  const seen = await browser.evaluate(() => {
    const record = (window as unknown as { __e2eSweep: { stop: boolean } }).__e2eSweep;
    record.stop = true;
    return record as unknown as { lowest: number; most: number; closedFrames: number };
  });
  expect(seen.lowest, 'the lowest opacity of the panel during the sweep').toBeGreaterThanOrEqual(0.99);
  expect(seen.most, 'panels mounted at once').toBe(1);
  expect(seen.closedFrames, 'frames with a closing panel').toBe(0);

  // The sweep ends on Console's menu alone: one panel, open, with one menu in it, at rest.
  await expect(browser.locator('#nd-nav').getByRole('button', 'Console')).toHaveAttribute('aria-expanded', 'true');
  await expect(browser.locator(MENU_PANEL)).toHaveCount(1);
  await expect(browser.locator(`${MENU_PANEL} > [data-motion]`)).toHaveCount(1);
  const rest = await browser.evaluate((panel) => {
    const menu = document.querySelector(`${panel} > [data-motion]`);
    return menu ? Number(getComputedStyle(menu).opacity) : 0;
  }, MENU_PANEL);
  expect(rest).toBe(1);
});

for (const key of ['Tab', 'Escape']) {
  test(`${key} during a close the pointer started unmounts the panel, and its links take no click`, async ({
    app,
    browser,
  }) => {
    await openAsReturningVisitor(app, browser, '/grants');
    await desktopOnly(browser, 'the menu panel is the desktop navbar');
    await waitForHydration(browser, '#nd-nav nav button[aria-controls]');

    // Click the Solutions trigger outside its inner link (the link opens /solutions): on the button's own padding.
    const spot = await browser.evaluate(() => {
      const trigger = [...document.querySelectorAll('#nd-nav nav button[aria-controls]')].find(
        (button) => button.textContent?.trim() === 'Solutions',
      )!;
      const button = trigger.getBoundingClientRect();
      const link = trigger.querySelector('a')!.getBoundingClientRect();
      return { x: (link.right + button.right) / 2, y: button.top + button.height / 2 };
    });
    await browser.mouse.move(spot.x, spot.y);
    await browser.mouse.down();
    await browser.mouse.up();
    await expect(browser.locator(MENU_PANEL)).toHaveAttribute('data-state', 'open');
    await pause(400);
    const card = await browser
      .locator(MENU_PANEL)
      .getByRole('link', /^Why Avalanche\b/)
      .boundingBox();
    expect(card).not.toBeNull();

    // The key, and the panel's state when it came.
    await browser.evaluate((panel) => {
      const states: string[] = [];
      (window as unknown as { __e2eKeyState: string[] }).__e2eKeyState = states;
      window.addEventListener(
        'keydown',
        () => states.push(document.querySelector(panel)?.getAttribute('data-state') ?? 'unmounted'),
        true,
      );
      return null;
    }, MENU_PANEL);
    // The pointer leaves; Radix starts the close about 150ms later. Wait for it in the page, then press at once,
    // inside the 120ms exit.
    await browser.mouse.move(700, 700);
    await browser.evaluate(
      (panel) =>
        new Promise<null>((resolve) => {
          const check = () => {
            const node = document.querySelector(panel);
            if (!node || node.getAttribute('data-state') === 'closed') resolve(null);
            else requestAnimationFrame(check);
          };
          check();
        }),
      MENU_PANEL,
    );
    await browser.keyboard.press(key);
    expect(
      await browser.evaluate(() => (window as unknown as { __e2eKeyState: string[] }).__e2eKeyState),
      'the panel when the key came',
    ).toEqual(['closed']);

    await expect(browser.locator(MENU_PANEL)).toHaveCount(0, { timeout: 1_000 });
    // Where the menu's first card was, a click reaches the page: /grants stays.
    await browser.mouse.move(card!.x + 40, card!.y + 40);
    await browser.mouse.down();
    await browser.mouse.up();
    await pause(1_500);
    await expect(browser).toHaveURL('/grants');
  });
}
