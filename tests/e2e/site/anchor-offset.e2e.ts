import { test } from '@e2e-dev/web';
import type { Browser } from '@e2e-dev/web';
import { expect } from 'e2e';
import { openAsReturningVisitor } from './helpers';

// site-anchor-offset (app/global.css): an in-page link lands its target below the sticky navbar (scroll padding of
// 4.5rem), not under it. /grants has no scroll margin of its own, so the page's padding decides where "View Programs"
// lands the Grant Programs section.

/** The heading's top and the navbar's bottom, once the smooth scroll has stopped: two reads 300ms apart agree. */
async function settled(browser: Browser) {
  const read = () =>
    browser.evaluate(() => {
      const heading = [...document.querySelectorAll('h2')].find((h) => h.textContent?.trim() === 'Grant Programs');
      const navbar = document.querySelector('#nd-nav');
      if (!heading || !navbar) return null;
      return {
        scrollY: Math.round(window.scrollY),
        top: Math.round(heading.getBoundingClientRect().top),
        navbarBottom: Math.round(navbar.getBoundingClientRect().bottom),
      };
    });
  let last = await read();
  await expect
    .poll(
      async () => {
        await new Promise((resolve) => setTimeout(resolve, 300));
        const now = await read();
        const still = JSON.stringify(now) === JSON.stringify(last) && (now?.scrollY ?? 0) > 0;
        last = now;
        return still;
      },
      { timeout: 15_000, message: 'the page did not stop scrolling' },
    )
    .toBe(true);
  return last!;
}

test('View Programs lands the Grant Programs heading below the navbar', async ({ app, screen, browser }) => {
  await openAsReturningVisitor(app, browser, '/grants');
  const heading = screen.getByRole('heading', 'Grant Programs', { level: 2 });
  await expect(heading).toBeAttached();

  await screen.getByRole('link', 'View Programs').tap();
  await expect(browser).toHaveURL('/grants#programs');
  const { top, navbarBottom } = await settled(browser);
  expect(navbarBottom, 'the sticky navbar is at the top of the screen').toBeGreaterThan(0);
  expect(top, 'the heading top, below the navbar bottom').toBeGreaterThanOrEqual(navbarBottom);
});
