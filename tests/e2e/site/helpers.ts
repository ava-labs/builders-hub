import type { Browser } from '@e2e-dev/web';
import { expect, type App, type Locator, type Screen } from 'e2e';
import { isPhoneLayout } from '../lib/skip';

// A dev server compiles a route on its first visit, and again after a code change.
// Under load a client navigation to such a route can take this long. A built site needs a few seconds.
export const NAVIGATION_TIMEOUT = 150_000;

// The test timeout for a test that opens a page and then navigates to a second route.
export const TWO_ROUTE_TIMEOUT = 240_000;

// A first visit shows the privacy banner, and a first Console visit can show a welcome dialog.
// A returning visitor has answered both. Write those answers to localStorage, then open the page.
// All URLs of the site share one localStorage. A small static file loads fast, so write the answers there.
// Set answeredConsoleWelcome to false for a visitor who has answered the privacy banner only.
export async function openAsReturningVisitor(
  app: App,
  browser: Browser,
  path: string,
  { answeredConsoleWelcome = true } = {},
): Promise<void> {
  await app.open('/small-logo.png');
  await browser.evaluate((welcome) => {
    localStorage.setItem('cookie_consent', 'no');
    if (welcome) {
      localStorage.setItem(
        'console-onboarding-tour',
        JSON.stringify({ state: { hasCompletedTour: true, hasSeenWelcome: true }, version: 0 }),
      );
    }
    return null;
  }, answeredConsoleWelcome);
  await app.open(path);
}

// Opens one top menu of the site navbar and returns the area that holds its links.
// Desktop: hover the trigger. The panel opens under the navbar.
// Phone: tap the menu button. One sheet holds the links of every menu.
export async function openSiteMenu(screen: Screen, browser: Browser, menu: string): Promise<Locator> {
  const phone = await isPhoneLayout(browser);
  // #nd-nav is the fumadocs navbar. The open panel renders inside it.
  const navbar = browser.locator('#nd-nav');
  const trigger = phone ? screen.getByRole('button', 'Toggle Menu') : navbar.getByRole('button', menu);
  // A hover or tap before React hydrates does nothing. Try again until the menu opens.
  await expect
    .poll(
      async () => {
        if ((await trigger.getAttribute('aria-expanded')) === 'true') return true;
        if (phone) {
          await trigger.tap();
        } else {
          // Move off the trigger first, so the next hover is a new pointer entry.
          await browser.mouse.move(0, 0);
          await trigger.hover();
        }
        return false;
      },
      { timeout: 60_000, interval: 2_000 },
    )
    .toBe(true);
  // The phone sheet is a custom component (components/navigation/navbar-dropdown.tsx).
  return phone ? browser.locator('[data-navbar-dropdown]') : navbar;
}
