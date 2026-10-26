import { test } from '@e2e-dev/web';
import { expect } from 'e2e';
import { desktopOnly } from '../lib/skip';
import { waitForHydration } from '../lib/hydration';
import { openAsReturningVisitor } from './helpers';

// site-nav-tab-stops and site-focus-ring (app/layout.config.tsx, app/global.css): each navbar item is one tab stop.
// The link inside the Solutions, Developers, Console and Explorer triggers leaves the tab order (its page is one Enter
// away in the menu); Ecosystem keeps its link, since its menu has no /ecosystem entry. Every stop shows the house
// ring: a 2px solid #E6212F outline, 2px off the control.

/** The stops after the logo, in order, up to the search pill: 7 presses of Tab. */
const STOPS = [
  { role: 'button', name: 'Solutions' },
  { role: 'button', name: 'Developers' },
  { role: 'button', name: 'Console' },
  { role: 'button', name: 'Explorer' },
  { role: 'button', name: 'Ecosystem' },
  { role: 'link', name: 'Ecosystem' },
  { role: 'button', name: 'Search ⌘ K' },
] as const;

test('Tab from the logo stops once on each navbar item, with the 2px focus ring', async ({ app, browser }) => {
  await openAsReturningVisitor(app, browser, '/');
  await desktopOnly(browser, 'the phone navbar folds the five items into its menu');
  const navbar = browser.locator('#nd-nav');
  // React must own the triggers: hydration replaces nothing, but a focus moved before it can be reset.
  await waitForHydration(browser, '#nd-nav nav button[aria-controls]');

  const logo = navbar.getByRole('link', 'Avalanche Builder Hub');
  await logo.focus();
  await expect(logo).toBeFocused();

  for (const stop of STOPS) {
    await browser.keyboard.press('Tab');
    await expect(navbar.getByRole(stop.role, stop.name)).toBeFocused();
    // The ring is set at rest and only its style changes on focus, so it shows on the first frame.
    const ring = await browser.evaluate(() => {
      const style = getComputedStyle(document.activeElement as Element);
      return `${style.outlineStyle} ${style.outlineWidth} ${style.outlineColor} offset ${style.outlineOffset}`;
    });
    expect(ring, `the focus ring of the ${stop.role} ${stop.name}`).toBe('solid 2px rgb(230, 33, 47) offset 2px');
  }
});
