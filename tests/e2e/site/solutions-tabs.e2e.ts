import { test } from '@e2e-dev/web';
import type { Browser } from '@e2e-dev/web';
import { expect } from 'e2e';
import { waitForHydration } from '../lib/hydration';
import { NAVIGATION_TIMEOUT, openAsReturningVisitor, openSiteMenu } from './helpers';

// sol-tab-glide (components/landing-v2/SolutionsShell.tsx): each Solutions page mounts its own subnav, and a pillar
// tab hands the next page's subnav the old one's place. From a page scrolled past the point where the subnav pins,
// the new page opens at that point (its content right under the subnav), the bar holds still and the red underline
// ends under the opened tab. The hand-off lives only as long as the page that armed it: a tab press whose navigation
// never lands must not steer a later arrival at that pillar.

const SUBNAV = '[data-solutions-subnav]';

/** The bar's top, the opened tab and its underline, the scroll, and the scroll at which the bar pins (pinScrollY). */
function readSubnav(browser: Browser) {
  return browser.evaluate((css) => {
    const bar = document.querySelector<HTMLElement>(css);
    const sheet = bar?.parentElement;
    if (!bar || !sheet) return null;
    const tab = bar.querySelector('nav a[aria-current="page"]');
    const line = tab?.querySelector('span[aria-hidden]');
    const pinAt =
      sheet.getBoundingClientRect().top +
      window.scrollY +
      parseFloat(getComputedStyle(sheet).paddingTop) -
      parseFloat(getComputedStyle(bar).top);
    const box = (node: Element | null | undefined) => {
      if (!node) return null;
      const { left, right, bottom } = node.getBoundingClientRect();
      return { left: Math.round(left), right: Math.round(right), bottom: Math.round(bottom) };
    };
    return {
      barTop: Math.round(bar.getBoundingClientRect().top),
      tab: tab?.textContent?.trim() ?? null,
      tabBox: box(tab),
      lineBox: box(line),
      scrollY: Math.round(window.scrollY),
      pinAt: Math.round(pinAt),
    };
  }, SUBNAV);
}

/** Scrolls to `top`, or as far as the page goes, until the scroll holds still well past the subnav (600px). */
async function scrollTo(browser: Browser, top: number) {
  await browser.evaluate((y) => {
    window.scrollTo({
      top: Math.min(y, document.documentElement.scrollHeight - window.innerHeight),
      behavior: 'instant',
    });
    return null;
  }, top);
  let last = -1;
  await expect
    .poll(async () => {
      await new Promise((resolve) => setTimeout(resolve, 200));
      const now = await browser.evaluate(() => Math.round(window.scrollY));
      const still = now === last && now > 600;
      last = now;
      return still;
    })
    .toBe(true);
}

test('a pillar tab from a scrolled page holds the subnav and opens the next page at its top', async ({
  app,
  screen,
  browser,
}) => {
  await openAsReturningVisitor(app, browser, '/solutions/performance');
  await waitForHydration(browser, `${SUBNAV} nav a`);
  await scrollTo(browser, 1500);
  const before = (await readSubnav(browser))!;
  expect(before.tab).toBe('PERFORMANCE');
  expect(before.scrollY, 'the page is scrolled past the pin point').toBeGreaterThan(before.pinAt);

  await screen.getByRole('navigation', 'Solutions sections').getByRole('link', 'PRIVACY').tap();
  await expect(browser).toHaveURL('/solutions/privacy', { timeout: NAVIGATION_TIMEOUT });
  // At rest: the underline sits under the opened tab.
  await expect
    .poll(async () => {
      const now = await readSubnav(browser);
      const settled =
        now?.tab === 'PRIVACY' &&
        now.lineBox !== null &&
        now.tabBox !== null &&
        now.lineBox.left === now.tabBox.left &&
        now.lineBox.right === now.tabBox.right;
      return settled ? now.tab : JSON.stringify(now);
    })
    .toBe('PRIVACY');
  const after = (await readSubnav(browser))!;
  expect(after.barTop, 'the subnav bar holds its place').toBe(before.barTop);
  expect(
    Math.abs(after.scrollY - after.pinAt),
    `scrollY ${after.scrollY} against the pin point ${after.pinAt}`,
  ).toBeLessThanOrEqual(3);
});

test(
  'a tab press that never lands leaves no hand-off for a later arrival',
  { timeout: 300_000 },
  async ({ app, screen, browser }) => {
    /** From /ecosystem scrolled down, the navbar's Solutions menu opens Privacy; the scroll it lands at. */
    const arriveAtPrivacy = async () => {
      await scrollTo(browser, 2000);
      const links = await openSiteMenu(screen, browser, 'Solutions');
      await links.getByRole('link', /^Privacy\b/).tap();
      await expect(browser).toHaveURL('/solutions/privacy', { timeout: NAVIGATION_TIMEOUT });
      await expect.poll(async () => (await readSubnav(browser))?.tab ?? null).toBe('PRIVACY');
      // html scrolls smoothly, so Next's scroll to the new page can take a second or two: read it once it holds still.
      let last = -1;
      await expect
        .poll(async () => {
          await new Promise((resolve) => setTimeout(resolve, 300));
          const now = (await readSubnav(browser))?.scrollY ?? -1;
          const still = now === last;
          last = now;
          return still;
        })
        .toBe(true);
      return last;
    };

    await openAsReturningVisitor(app, browser, '/solutions/performance');
    await waitForHydration(browser, `${SUBNAV} nav a`);
    await scrollTo(browser, 1500);
    // Press the Privacy tab (it arms the hand-off), and in the same moment follow the navbar's Ecosystem link: the
    // tab's navigation is replaced before it lands.
    await browser.evaluate((css) => {
      const tab = [...document.querySelectorAll<HTMLElement>(`${css} nav a`)].find(
        (a) => a.textContent?.trim() === 'PRIVACY',
      );
      const ecosystem = document.querySelector<HTMLElement>('#nd-nav a[href="/ecosystem"]');
      tab!.click();
      ecosystem!.click();
      return null;
    }, SUBNAV);
    await expect(browser).toHaveURL('/ecosystem', { timeout: NAVIGATION_TIMEOUT });
    const afterAbandonedPress = await arriveAtPrivacy();

    // The same arrival with no tab press before it.
    await browser.evaluate(() => {
      document.querySelector<HTMLElement>('#nd-nav a[href="/ecosystem"]')!.click();
      return null;
    });
    await expect(browser).toHaveURL('/ecosystem', { timeout: NAVIGATION_TIMEOUT });
    const plain = await arriveAtPrivacy();
    expect(
      Math.abs(afterAbandonedPress - plain),
      `${afterAbandonedPress} after the abandoned press, ${plain} without`,
    ).toBeLessThanOrEqual(2);
    // A stale hand-off would have opened the page at the pin point instead of Next's own landing at its top.
    const { pinAt } = (await readSubnav(browser))!;
    expect(
      Math.abs(afterAbandonedPress - pinAt),
      `${afterAbandonedPress} against the pin point ${pinAt}`,
    ).toBeGreaterThan(3);
  },
);
