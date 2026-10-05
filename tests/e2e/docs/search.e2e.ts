import { test } from '@e2e-dev/web';
import { expect } from 'e2e';
import { NAVIGATION, openDocsPage } from './docs-page';

// The navbar button reads "Search ⌘ K" on desktop and "Open Search" on phone.
const SEARCH_BUTTON = /^(Open Search|Search)/;

test('search finds a docs page and opens it', async ({ app, screen, browser }) => {
  await openDocsPage(app, browser, '/docs/primary-network');
  await screen.getByRole('button', SEARCH_BUTTON).tap();
  const dialog = screen.getByRole('dialog', 'Search');
  await expect(dialog).toBeVisible();
  await dialog.getByRole('textbox', 'Search').fill('ICM Contract Addresses');
  // The page row carries the page title. The section rows under it carry other text.
  const result = dialog.getByRole('button', 'ICM Contract Addresses');
  await expect(result).toBeVisible();
  await result.tap();
  // A relative URL must match on the site under test. A result that opens build.avax.network fails.
  await expect(browser).toHaveURL('/docs/cross-chain/icm-contracts/addresses', NAVIGATION);
  await expect(screen.getByRole('heading', 'ICM Contract Addresses', { level: 1 })).toBeVisible();
  await expect(dialog).toBeHidden();
});

test('keyboard shortcut opens search and Escape closes it', async ({ app, screen, browser }) => {
  await openDocsPage(app, browser, '/docs/primary-network');
  await browser.keyboard.press('ControlOrMeta+k');
  const dialog = screen.getByRole('dialog', 'Search');
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('textbox', 'Search')).toBeFocused();
  await browser.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
});
