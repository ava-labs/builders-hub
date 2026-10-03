import { test } from '@e2e-dev/web';
import { expect } from 'e2e';
import { NAVIGATION, openDocsPage } from '../docs/docs-page';
import { desktopOnly, needsModel } from '../lib/skip';

// The agent picks the search words and the result. The judge then reads the page it opened.
// A locator can check the URL, but not that the page answers the question.
test('docs search answers how to add a validator to an L1', async (fixtures) => {
  needsModel();
  const { app, agent, browser } = fixtures;
  await openDocsPage(app, browser, '/docs/primary-network');
  await desktopOnly(browser, 'search works the same at both sizes; docs/search.e2e.ts tests the phone search');
  // The result must open on the site under test, not on build.avax.network.
  const origin = await browser.evaluate(() => location.origin);
  await agent.act('search the docs for how to add a validator to an L1, and open the most relevant result');
  await expect(browser).toHaveURL(new RegExp(`^${origin.replace(/[.:/]/g, '\\$&')}/docs/`), NAVIGATION);
  await agent.assert('the page explains how to add or register a validator on an Avalanche L1');
});
