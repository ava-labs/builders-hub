import { test } from '@e2e-dev/web';
import type { Browser } from '@e2e-dev/web';
import { expect, type App, type Screen } from 'e2e';
import { desktopOnly } from '../lib/skip';
import { waitForHydration } from '../lib/hydration';
import { openAsReturningVisitor } from './helpers';

// Blog posts (Task 19):
// - eco-blog-outline (components/blog/blog-outline.tsx): from 1024px a long post lists its headings beside the text
//   ("On this page"), and marks the one being read (aria-current="true") as the page scrolls. The list does not trap
//   the wheel: over an outline that fits, a wheel scrolls the page; an outline taller than its box (capped at the
//   window below its sticky top) scrolls itself first, and once it is at its end the next wheel scrolls the page.
// - eco-blog-image-zoom (components/ui/zoomable-image.tsx): a chart opens full size from the keyboard too (the zoom
//   button over the image takes Enter), Escape closes it, and the focus goes back to the button.

/** A post whose outline is taller than its box (986px in 812px at 1440 x 900), so the list scrolls on its own. */
const OUTLINE_POST = '/blog/granite-upgrade';
/** A post whose outline fits its box. */
const SHORT_OUTLINE_POST = '/blog/helicon-upgrade';
const CHART_POST = '/blog/p2p-network-anomalies';

/** The page's scroll and the outline's own scroll, once both hold still: two reads 200ms apart agree. */
async function settledScrolls(browser: Browser) {
  const read = () =>
    browser.evaluate(() => {
      const outline = document.querySelector('nav[aria-label="On this page"]')!;
      return {
        page: Math.round(window.scrollY),
        list: Math.round(outline.scrollTop),
        listEnd: Math.round(outline.scrollHeight - outline.clientHeight),
      };
    });
  let last = await read();
  await expect
    .poll(async () => {
      await new Promise((resolve) => setTimeout(resolve, 200));
      const now = await read();
      const still = JSON.stringify(now) === JSON.stringify(last);
      last = now;
      return still;
    })
    .toBe(true);
  return last;
}

/** Opens a post, and puts the pointer over its outline, at a point on screen. */
async function pointerOverOutline(app: App, screen: Screen, browser: Browser, post: string) {
  await openAsReturningVisitor(app, browser, post);
  await desktopOnly(browser, 'the outline shows from 1024px');
  const outline = screen.getByRole('navigation', 'On this page');
  await expect(outline).toBeVisible();
  await waitForHydration(browser, 'nav[aria-label="On this page"] a');
  const box = (await outline.boundingBox())!;
  const viewport = await browser.evaluate(() => window.innerHeight);
  await browser.mouse.move(box.x + box.width / 2, Math.min(box.y + 40, viewport - 20));
}

test('the blog outline marks the section being read while the page scrolls', async ({ app, screen, browser }) => {
  await openAsReturningVisitor(app, browser, OUTLINE_POST);
  await desktopOnly(browser, 'the outline shows from 1024px');
  const outline = screen.getByRole('navigation', 'On this page');
  await expect(outline).toBeVisible();
  await waitForHydration(browser, 'nav[aria-label="On this page"] a');
  const marked = () =>
    browser.evaluate(() =>
      [...document.querySelectorAll('nav[aria-label="On this page"] a[aria-current="true"]')].map((a) =>
        a.getAttribute('href'),
      ),
    );

  // Two entries in turn: the third, then the sixth. Each heading is brought 100px down the window, past its line.
  for (const index of [2, 5]) {
    const href = await browser.evaluate((at) => {
      const links = [...document.querySelectorAll('nav[aria-label="On this page"] a')];
      const target = links[at].getAttribute('href')!;
      const heading = document.getElementById(decodeURIComponent(target.slice(1)))!;
      window.scrollTo({ top: heading.getBoundingClientRect().top + window.scrollY - 100, behavior: 'instant' });
      return target;
    }, index);
    await expect.poll(marked).toEqual([href]);
  }
});

test('one wheel over an outline that fits scrolls the page', async ({ app, screen, browser }) => {
  await pointerOverOutline(app, screen, browser, SHORT_OUTLINE_POST);
  const before = await settledScrolls(browser);
  expect(before.listEnd, 'the outline fits its box: it has nothing to scroll').toBe(0);
  await browser.mouse.wheel(0, 400);
  const after = await settledScrolls(browser);
  expect(after.page - before.page, 'page scroll from one wheel').toBeGreaterThan(100);
});

test('a wheel over a long outline scrolls it to its end, then the next wheel scrolls the page', async ({
  app,
  screen,
  browser,
}) => {
  await pointerOverOutline(app, screen, browser, OUTLINE_POST);
  let scrolls = await settledScrolls(browser);
  expect(scrolls.listEnd, 'the outline is taller than its box').toBeGreaterThan(0);
  // The list takes the wheel until it reaches its end (one 400px wheel on this post).
  for (let wheels = 0; scrolls.list < scrolls.listEnd; wheels++) {
    expect(wheels, 'wheels the outline took without reaching its end').toBeLessThan(5);
    await browser.mouse.wheel(0, 400);
    scrolls = await settledScrolls(browser);
  }
  // At its end the outline has nothing left to scroll, so the next wheel goes to the page.
  await browser.mouse.wheel(0, 400);
  const after = await settledScrolls(browser);
  expect(after.page - scrolls.page, 'page scroll from the wheel after the outline reached its end').toBeGreaterThan(
    100,
  );
});

test('a chart opens its zoom from the keyboard, and Escape closes it with the focus back', async ({
  app,
  screen,
  browser,
}) => {
  await openAsReturningVisitor(app, browser, CHART_POST);
  await desktopOnly(browser, 'the zoom is checked at the desktop size');
  const zoom = screen.getByRole('button', /^Expand image\b/).first();
  await expect(zoom).toBeAttached();
  await waitForHydration(browser, 'button[aria-label^="Expand image"]');
  // From the keyboard: Tab onto the zoom button of the first chart (it is in the tab order), then Enter.
  await zoom.focus();
  await browser.keyboard.press('Shift+Tab');
  await browser.keyboard.press('Tab');
  await expect(zoom).toBeFocused();
  await browser.keyboard.press('Enter');
  const dialog = screen.getByRole('dialog');
  await expect(dialog).toBeVisible();

  await browser.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(zoom).toBeFocused();
});
