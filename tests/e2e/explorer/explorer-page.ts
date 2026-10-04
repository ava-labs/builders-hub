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

// The tab rail of the explorer subnav (components/explorer-v2/ExplorerSubnav.tsx).
export function sectionTabs(screen: Screen): Locator {
  return screen.getByRole('navigation', 'Explorer sections');
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
