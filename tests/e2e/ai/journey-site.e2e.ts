import { test } from '@e2e-dev/web';
import { expect } from 'e2e';
import { desktopOnly, needsModel } from '../lib/skip';
import { waitForHydration } from '../lib/hydration';
import { NAVIGATION_TIMEOUT, TWO_ROUTE_TIMEOUT, openAsReturningVisitor } from '../site/helpers';

// Two acts, each followed by its own check, so the replay cache records each one.
// site/navbar.e2e.ts checks each menu link from the home page. This test checks that a visitor finds two
// pages from plain words, the second one from a page other than the home page.
// The second page is Integrations, not Events: /events and /audits read the database, so a server without
// DATABASE_URL answers 500 and the step can never record. site/pages.e2e.ts checks the Events page.
test('visitor goes from the home page to Grants and then to Integrations', { timeout: TWO_ROUTE_TIMEOUT }, async (fixtures) => {
  needsModel();
  const { app, agent, browser } = fixtures;
  await openAsReturningVisitor(app, browser, '/');
  await desktopOnly(browser, 'site/navbar.e2e.ts tests the phone menu');
  await waitForHydration(browser, '#nd-nav');
  await agent.act('use the site navigation to open the Grants page');
  await expect(browser).toHaveURL(/\/grants(\?|$)/, { timeout: NAVIGATION_TIMEOUT });
  // A missing page keeps its URL but shows the 404 page, so check the page title too.
  await expect(browser).toHaveTitle('Grants | Avalanche Builder Hub');
  // The next act starts on a new page. Wait until its navbar is live, because a replayed step does not retry.
  await waitForHydration(browser, '#nd-nav');
  await agent.act('use the site navigation to open the Integrations page');
  await expect(browser).toHaveURL(/\/integrations(\?|#|$)/, { timeout: NAVIGATION_TIMEOUT });
  await expect(browser).toHaveTitle('Integrations | Avalanche Builder Hub');
});
