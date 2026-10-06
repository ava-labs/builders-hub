import { test } from '@e2e-dev/web';
import { expect } from 'e2e';
import { phoneOnly } from '../lib/skip';
import { DATA, NAVIGATION, navbarSlot, pathPattern, sectionTabs } from './explorer-page';

// Below 640 px the chain switcher sits in the site navbar (components/explorer-v2/navbar-slot.tsx): left of the
// centered logo, level with the menu button, with the network under the chain name. Its menu starts with the
// Mainnet/Fuji switch. The tab rail under the navbar keeps the section tabs and, at its right end, the time range.
// Wider screens keep the switcher and the network in the rail (explorer/chain-switch.e2e.ts covers both sizes).

// The native select of the page clock. Its name can end with the selected option, so match the start only.
const TIME_RANGE = /^Time range for all stats on this page/;

// Two boxes are level when their vertical centers are this close, in CSS px.
const LEVEL_TOLERANCE = 3;

function centerY(box: { y: number; height: number }): number {
  return box.y + box.height / 2;
}

test('phone explorer header puts the chain switcher in the navbar and the time range in the tab rail', async ({
  app,
  screen,
  browser,
}) => {
  await app.open('/explorer/mainnet/c-chain');
  await phoneOnly(browser);
  const navbar = browser.locator('#nd-nav');
  const trigger = navbar.getByRole('button', 'C-Chain');
  await expect(trigger).toBeVisible();

  // The switcher is level with the menu button and ends before the centered logo.
  const switcherBox = await trigger.boundingBox();
  const menuButtonBox = await navbar.getByRole('button', 'Toggle Menu').boundingBox();
  const logoBox = await navbar.getByRole('link', 'Avalanche Builder Hub').boundingBox();
  expect(switcherBox).not.toBeNull();
  expect(menuButtonBox).not.toBeNull();
  expect(logoBox).not.toBeNull();
  expect(Math.abs(centerY(switcherBox!) - centerY(menuButtonBox!))).toBeLessThanOrEqual(LEVEL_TOLERANCE);
  expect(switcherBox!.x + switcherBox!.width).toBeLessThanOrEqual(logoBox!.x);

  // The time range is in the tab rail, on the row of the section tabs, after them. It appears only when a stat on
  // the page listens to it, and the stats load after the page renders.
  const range = browser.locator('[data-explorer-subnav]').getByRole('combobox', TIME_RANGE);
  await expect(range).toBeVisible(DATA);
  const rangeBox = await range.boundingBox();
  const tabsBox = await sectionTabs(screen).boundingBox();
  expect(rangeBox).not.toBeNull();
  expect(tabsBox).not.toBeNull();
  expect(Math.abs(centerY(rangeBox!) - centerY(tabsBox!))).toBeLessThanOrEqual(LEVEL_TOLERANCE);
  expect(rangeBox!.x).toBeGreaterThanOrEqual(tabsBox!.x + tabsBox!.width);

  // The strip that sat under the rail is gone. The page has one time range, and with the menu closed no
  // Mainnet/Fuji switch shows. No element after the rail holds either control, not even a hidden one.
  await expect(screen.getByRole('combobox', TIME_RANGE)).toHaveCount(1);
  await expect(screen.getByRole('link', 'Mainnet')).toHaveCount(0);
  await expect(screen.getByRole('link', 'Fuji')).toHaveCount(0);
  const afterRail = await browser.evaluate(() => {
    const rail = document.querySelector('[data-explorer-subnav]');
    if (!rail) return null;
    return [...document.querySelectorAll('select, a')]
      .filter((el) => !rail.contains(el) && rail.compareDocumentPosition(el) & Node.DOCUMENT_POSITION_FOLLOWING)
      .filter((el) =>
        el.tagName === 'SELECT'
          ? (el.closest('label')?.textContent ?? '').startsWith('Time range for all stats on this page')
          : ['Mainnet', 'Fuji'].includes((el.textContent ?? '').trim()),
      )
      .map((el) => el.outerHTML.slice(0, 120));
  });
  expect(afterRail, 'time range or network controls after the tab rail').toEqual([]);

  // The menu starts with the network row: Mainnet is the current network, and both links sit above the filter.
  await trigger.tap();
  await expect(trigger).toHaveAttribute('aria-expanded', 'true');
  const menu = screen.getByRole('dialog', 'Switch chain');
  const mainnet = menu.getByRole('link', 'Mainnet');
  const fuji = menu.getByRole('link', 'Fuji');
  const filter = menu.getByRole('textbox', 'Filter chains');
  await expect(mainnet).toHaveAttribute('aria-current', 'page');
  await expect(fuji).not.toHaveAttribute('aria-current');
  // On a phone the keyboard would cover the list, so the filter does not take the focus.
  await expect(filter).not.toBeFocused();
  const filterBox = await filter.boundingBox();
  expect(filterBox).not.toBeNull();
  for (const link of [mainnet, fuji]) {
    const box = await link.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.y + box!.height).toBeLessThanOrEqual(filterBox!.y);
  }

  // Fuji switches the network and closes the menu. The button shows the new network under the chain name. That
  // caption is aria-hidden (the button's name stays the chain), so a text query skips it: read the button's text.
  // The engine reads the rendered text, which CSS sets in upper case.
  await fuji.tap();
  await expect(browser).toHaveURL(pathPattern('/explorer/fuji/c-chain'), NAVIGATION);
  const after = navbarSlot(browser).getByRole('button', 'C-Chain');
  await expect(after).toContainText('FUJI');
  await expect(after).toHaveAttribute('aria-expanded', 'false');
  await expect(screen.getByRole('dialog', 'Switch chain')).toHaveCount(0);
});

test('phone navbar shows All Networks in full, left of the logo', async ({ app, browser }) => {
  await app.open('/explorer/mainnet');
  await phoneOnly(browser);
  const navbar = browser.locator('#nd-nav');
  const trigger = navbar.getByRole('button', 'All Networks');
  await expect(trigger).toBeVisible();

  const switcherBox = await trigger.boundingBox();
  const logoBox = await navbar.getByRole('link', 'Avalanche Builder Hub').boundingBox();
  expect(switcherBox).not.toBeNull();
  expect(logoBox).not.toBeNull();
  expect(switcherBox!.x + switcherBox!.width).toBeLessThanOrEqual(logoBox!.x);

  // The name has no ellipsis: its span is as wide as its text. The web font sets the width, so wait for it.
  const name = await browser.evaluate(async () => {
    await document.fonts.ready;
    const span = [...document.querySelectorAll('[data-explorer-navbar-slot] button span')].find(
      (el) => el.children.length === 0 && el.textContent?.trim() === 'All Networks',
    );
    return span ? { scrollWidth: span.scrollWidth, clientWidth: span.clientWidth } : null;
  });
  expect(name, 'the All Networks label in the navbar').not.toBeNull();
  expect(name!.scrollWidth).toBeLessThanOrEqual(name!.clientWidth);
});
