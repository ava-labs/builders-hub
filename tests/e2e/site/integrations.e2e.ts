import { test } from '@e2e-dev/web';
import type { Browser } from '@e2e-dev/web';
import { expect } from 'e2e';
import { desktopOnly, phoneOnly } from '../lib/skip';
import { waitForHydration } from '../lib/hydration';
import { openAsReturningVisitor } from './helpers';

// The /integrations category list (app/integrations/page.client.tsx, lib/scroll-spy.ts):
// - int-phone-categories: below 768px the list folds into one Categories row that opens it in place. Folded, the list
//   is invisible, so its links take no tap and no focus.
// - int-scroll-spy: from 768px the list marks the category being read (aria-current) as the page scrolls, and the
//   last one once the page can scroll no further.

const LIST = '#integration-categories';

/** Whether the focused element is a link of the category list. */
const focusInList = (browser: Browser) =>
  browser.evaluate((css) => document.querySelector(css)?.contains(document.activeElement) ?? false, LIST);

test('on a phone the Categories row opens and closes the category list', async ({ app, screen, browser }) => {
  await openAsReturningVisitor(app, browser, '/integrations');
  await phoneOnly(browser, 'the list folds below 768px');
  await waitForHydration(browser, `${LIST}`);
  const row = screen.getByRole('button', 'Categories');
  const links = browser.locator(LIST).getByRole('link');
  await expect(row).toHaveAttribute('aria-expanded', 'false');
  // Folded: the links are out of the accessibility tree and out of the tab order.
  await expect(links).toHaveCount(0);
  await row.focus();
  await browser.keyboard.press('Tab');
  expect(await focusInList(browser), 'Tab from the folded row reaches the list').toBe(false);

  await row.tap();
  await expect(row).toHaveAttribute('aria-expanded', 'true');
  await expect(links.first()).toBeVisible();
  await row.focus();
  await browser.keyboard.press('Tab');
  await expect(links.first()).toBeFocused();

  await row.tap();
  await expect(row).toHaveAttribute('aria-expanded', 'false');
  await expect(links).toHaveCount(0);
  await row.focus();
  await browser.keyboard.press('Tab');
  expect(await focusInList(browser), 'Tab from the folded row reaches the list').toBe(false);
});

/** The rows the list marks as being read, by the category they open. */
const markedRows = (browser: Browser) =>
  browser.evaluate(
    (css) => [...document.querySelectorAll(`${css} a[aria-current="true"]`)].map((row) => row.getAttribute('href')),
    LIST,
  );

test('on a desktop the category list marks the section being read, and the last one at the page end', async ({
  app,
  browser,
}) => {
  await openAsReturningVisitor(app, browser, '/integrations');
  await desktopOnly(browser, 'the list shows beside the cards from 768px');
  await waitForHydration(browser, `${LIST} a`);

  // A section in the middle of the page: its heading 100px down the window, past the navbar.
  const target = await browser.evaluate(() => {
    const sections = [...document.querySelectorAll('section[id]')];
    const section = sections[Math.floor(sections.length / 3)];
    window.scrollTo({ top: section.getBoundingClientRect().top + window.scrollY - 100, behavior: 'instant' });
    return section.id;
  });
  await expect.poll(() => markedRows(browser)).toEqual([`#${target}`]);
  await expect(
    browser.locator(LIST).getByRole('link', new RegExp(`^${target.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&')}`)),
  ).toHaveAttribute('aria-current', 'true');

  // At the end of the page the last section's row is marked, though its heading may never reach the line.
  const last = await browser.evaluate(() => {
    window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'instant' });
    const sections = [...document.querySelectorAll('section[id]')];
    return sections[sections.length - 1].id;
  });
  await expect.poll(() => markedRows(browser)).toEqual([`#${last}`]);
});
