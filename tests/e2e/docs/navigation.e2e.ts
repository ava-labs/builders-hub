import { test } from '@e2e-dev/web';
import { expect } from 'e2e';
import { NAVIGATION, docsSidebar, openDocsPage } from './docs-page';

test('docs home opens the primary network page', async ({ app, screen, browser }) => {
  await app.open('/docs');
  await expect(browser).toHaveURL('/docs/primary-network');
  await expect(browser).toHaveTitle('Primary Network | Avalanche Builder Hub');
  await expect(screen.getByRole('heading', 'Primary Network', { level: 1 })).toBeVisible();
  await expect(screen.getByRole('link', 'Network')).toHaveAttribute('aria-current', 'page');
});

test('section tabs reach each docs section', { timeout: 300_000 }, async ({ app, screen, browser }) => {
  // ACPs is not in the list: its pages come from build:remote, so a plain dev server has no /docs/acps.
  const sections = [
    { tab: 'Nodes', path: '/docs/nodes', heading: 'Introduction' },
    { tab: 'APIs', path: '/docs/api-reference/data-api', heading: 'Data API' },
    { tab: 'Tools', path: '/docs/tooling/avalanche-sdk', heading: 'Overview' },
    { tab: 'Network', path: '/docs/primary-network', heading: 'Primary Network' },
  ];
  await openDocsPage(app, browser, '/docs/primary-network');
  let previous = 'Network';
  for (const { tab, path, heading } of sections) {
    await screen.getByRole('link', tab).tap();
    await expect(browser).toHaveURL(path, NAVIGATION);
    await expect(screen.getByRole('heading', heading, { level: 1 })).toBeVisible();
    await expect(screen.getByRole('link', tab)).toHaveAttribute('aria-current', 'page');
    // Only one tab is current at a time.
    await expect(screen.getByRole('link', previous)).not.toHaveAttribute('aria-current');
    previous = tab;
  }
});

test('sidebar opens a nested page', async ({ app, screen, browser }) => {
  await openDocsPage(app, browser, '/docs/primary-network');
  const sidebar = await docsSidebar(screen, browser);
  const folder = sidebar.getByRole('button', 'Contract Verification');
  await folder.tap();
  await expect(folder).toBeExpanded();
  await sidebar.getByRole('link', 'Using HardHat').tap();
  await expect(browser).toHaveURL('/docs/primary-network/verify-contract/hardhat', NAVIGATION);
  await expect(screen.getByRole('heading', 'Using HardHat', { level: 1 })).toBeVisible();
});

test('API reference sidebar opens a guide page', async ({ app, screen, browser }) => {
  await openDocsPage(app, browser, '/docs/api-reference/data-api');
  await expect(screen.getByRole('heading', 'Data API', { level: 1 })).toBeVisible();
  const sidebar = await docsSidebar(screen, browser);
  await sidebar.getByRole('link', 'Getting Started').tap();
  await expect(browser).toHaveURL('/docs/api-reference/data-api/getting-started', NAVIGATION);
  await expect(screen.getByRole('heading', 'Getting Started', { level: 1 })).toBeVisible();
  await expect(screen.getByRole('link', 'APIs')).toHaveAttribute('aria-current', 'page');
});
