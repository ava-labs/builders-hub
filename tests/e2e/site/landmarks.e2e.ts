import { test } from '@e2e-dev/web';
import { expect } from 'e2e';
import { knownBug } from '../lib/skip';
import { openAsReturningVisitor } from './helpers';

// Each page has one main landmark and one level-1 heading. The site layout and the page shells
// must not both add a main. The explorer has no display title, so its shells add a visually hidden h1.

// The site layout (fumadocs HomeLayout, app/layout-wrapper.client.tsx) renders a <main> around every page.
const DOCS_LAYOUT_BUG = 'fumadocs DocsLayout renders a second <main> inside the HomeLayout <main>';
const PAGES: { path: string; bug?: string }[] = [
  { path: '/', bug: 'components/landing-v2 StoryHome renders a second <main> inside the HomeLayout <main>' },
  { path: '/docs/primary-network', bug: DOCS_LAYOUT_BUG },
  { path: '/academy' },
  { path: '/explorer/mainnet' },
  { path: '/explorer/mainnet/c-chain' },
  { path: '/explorer/mainnet/c-chain/blocks' },
];

for (const { path, bug } of PAGES) {
  test(`${path} has one main landmark and one h1`, async ({ app, screen, browser }) => {
    if (bug) knownBug(bug);
    await openAsReturningVisitor(app, browser, path);
    // Count after React hydrates, so the check reads the page as the visitor gets it.
    // React marks each node it hydrates with a __reactFiber$ key.
    await expect
      .poll(() => browser.evaluate(() => Object.keys(document.body).some((key) => key.startsWith('__reactFiber$'))), {
        message: `React did not hydrate ${path}`,
        timeout: 120_000,
      })
      .toBe(true);
    await expect(screen.getByRole('main')).toHaveCount(1);
    await expect(screen.getByRole('heading', { level: 1 })).toHaveCount(1);
  });
}
