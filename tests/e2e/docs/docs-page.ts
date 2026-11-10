import type { Browser } from '@e2e-dev/web';
import { expect, type App, type Locator, type Screen } from 'e2e';
import { isPhoneLayout } from '../lib/skip';

// Opens a docs page and waits until React has hydrated it.
// The docs layout sets body[data-layout="docs"] in an effect, so the attribute shows that click and key handlers are live.
export async function openDocsPage(app: App, browser: Browser, path: string): Promise<void> {
  await app.open(path);
  await expect(browser.locator('body[data-layout="docs"]')).toBeAttached();
}

// Returns the docs sidebar. On phone the sidebar is closed, so the test opens it from the navbar first.
export async function docsSidebar(screen: Screen, browser: Browser): Promise<Locator> {
  if (await isPhoneLayout(browser)) {
    await screen.getByRole('button', 'Toggle docs sidebar').tap();
  }
  const sidebar = screen.getByRole('complementary');
  await expect(sidebar).toBeVisible();
  return sidebar;
}

// A dev server compiles each docs page on its first visit, and a client navigation waits for that compile.
// Under load from parallel workers this can take more than 60 s. The academy and explorer folders use the same budget.
export const NAVIGATION = { timeout: 120_000 };

// Desktop shows the table of contents in a rail at the right (#nd-toc).
// Phone shows it in a bar under the subnav (#nd-tocnav). The bar has one button, and the button opens the list.
// The name of the button is the current section, so the helpers do not use the name.
const tocBarToggle = (browser: Browser): Locator => browser.locator('#nd-tocnav').getByRole('button');

// Returns the table of contents of the page. On phone the helper opens the list first.
export async function openTableOfContents(browser: Browser): Promise<Locator> {
  if (await isPhoneLayout(browser)) {
    await tocBarToggle(browser).tap();
    await expect(tocBarToggle(browser)).toBeExpanded();
    return browser.locator('#nd-tocnav');
  }
  const rail = browser.locator('#nd-toc');
  await expect(rail.getByRole('heading', 'On this page')).toBeVisible();
  return rail;
}

// On phone the list stays open after a jump and covers the page. The helper closes it as a user does.
export async function closeTableOfContents(browser: Browser): Promise<void> {
  if (await isPhoneLayout(browser)) {
    await tocBarToggle(browser).tap();
    await expect(tocBarToggle(browser)).not.toBeExpanded();
  }
}
