import { test } from '@e2e-dev/web';
import { expect } from 'e2e';
import { needsModel } from '../lib/skip';
import { openAsReturningVisitor } from '../site/helpers';
import { SCREENSHOT_ONLY, VISUAL, layoutIsIntact, waitForStillScreen } from './visual';

test('docs page is laid out without clipped or overlapping content', VISUAL, async (fixtures) => {
  needsModel();
  const { app, agent, browser, screen } = fixtures;
  await openAsReturningVisitor(app, browser, '/docs/primary-network');
  // The docs layout sets this attribute in an effect, so it shows that React has hydrated the page.
  await expect(browser.locator('body[data-layout="docs"]')).toBeAttached();
  await expect(screen.getByRole('heading', 'Primary Network', { level: 1 })).toBeVisible();
  await waitForStillScreen(browser);
  await agent.assert(
    layoutIsIntact(
      'the site header and the page heading "Primary Network" with the start of the article, all fully visible',
    ),
    SCREENSHOT_ONLY,
  );
});
