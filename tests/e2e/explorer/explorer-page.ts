import type { Browser } from '@e2e-dev/web';
import { expect, type Locator, type Screen } from 'e2e';

// A click renders the next page on the server, and the URL changes only when the server answers.
// Under load the dev server takes up to 40 s for a tx page. The docs and academy folders use the same budget.
export const NAVIGATION = { timeout: 120_000 };

// Rows and detail fields load from the data API after the page renders. Under load this takes more than the default 30 s.
export const DATA = { timeout: 90_000 };

// A test that visits several pages can wait for a first-visit compile at each step, so it gets more than the 180 s default.
export const MULTI_PAGE = { timeout: 360_000 };

// A "Latest Blocks" row on an overview: an optional chain name, a comma-grouped height, then the next cell.
export const OVERVIEW_BLOCK_ROW = /^([A-Z][\w .()-]*? )?\d{1,3}(,\d{3})+ [\dA-Z]/;

// A row of the Primary Network roster: the rank (desktop only), the title of the status dot once the status loads, then the NodeID.
export const VALIDATOR_ROW = /^(\d+ )?(Online |Offline |Connection not reported )?NodeID-[1-9A-HJ-NP-Za-km-z]+/;

// The tab rail of the explorer subnav (components/explorer-v2/ExplorerSubnav.tsx).
export function sectionTabs(screen: Screen): Locator {
  return screen.getByRole('navigation', 'Explorer sections');
}

// Below 640 px (Tailwind sm) the chain switcher sits in the site navbar, and its menu holds the Mainnet/Fuji
// switch (components/explorer-v2/navbar-slot.tsx). Wider screens show the switch at the right end of the tab rail.
async function switcherInNavbar(browser: Browser): Promise<boolean> {
  return browser.evaluate(() => window.matchMedia('(width < 40rem)').matches);
}

// The span at the left edge of the site navbar that holds the phone chain switcher.
export function navbarSlot(browser: Browser): Locator {
  return browser.locator('[data-explorer-navbar-slot]');
}

// Returns the area that holds the Mainnet/Fuji switch: the page on wider screens, and on phones the chain
// switcher menu, which this opens. The navbar switcher mounts only after hydration, so a tap on it works.
export async function networkSwitch(screen: Screen, browser: Browser): Promise<Screen> {
  if (!(await switcherInNavbar(browser))) return screen;
  // The closed menu has no buttons, so the trigger is the only button in the slot.
  const trigger = navbarSlot(browser).getByRole('button');
  await trigger.tap();
  await expect(trigger).toHaveAttribute('aria-expanded', 'true');
  return screen.getByRole('dialog', 'Switch chain');
}

// The tab with this label is the current page, and no other tab is current.
export async function expectActiveTab(screen: Screen, browser: Browser, label: string): Promise<void> {
  await expect(sectionTabs(screen).getByRole('link', label)).toHaveAttribute('aria-current', 'page');
  // A wrong isActive rule can mark two tabs. The role query cannot filter by aria-current, so a CSS selector counts them.
  await expect(browser.locator('nav[aria-label="Explorer sections"] [aria-current="page"]')).toHaveCount(1);
}

// The full URL with this exact path. A query string may follow, because a page can keep its own state there.
export function pathPattern(path: string): RegExp {
  const escaped = path.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`^https?://[^/]+${escaped}(\\?[^#]*)?$`);
}
