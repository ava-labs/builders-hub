import { test } from '@e2e-dev/web';
import { expect } from 'e2e';
import { NAVIGATION, openDocsPage } from '../docs/docs-page';
import { desktopOnly, needsModel } from '../lib/skip';

// The visitor names a task, not a page. The Nodes intro explains node roles; the guides are in a
// collapsed sidebar group. Every page under /docs/nodes/run-a-node is a setup guide.
// The test starts on /docs/nodes, not on another docs section: a tap on the "Nodes" tab leaves the
// pointer on the tab, its hover card (components/navigation/docs-subnav.tsx:109) stays open over
// the sidebar, and a replayed tap on the sidebar times out.
test('visitor finds the guide to run an Avalanche node from the Nodes docs', async (fixtures) => {
  needsModel();
  const { app, agent, browser } = fixtures;
  await openDocsPage(app, browser, '/docs/nodes');
  await desktopOnly(browser, 'docs/navigation.e2e.ts tests the phone sidebar');
  await agent.act('find the docs guide that shows how to set up and run an Avalanche node, and open it');
  await expect(browser).toHaveURL(/\/docs\/nodes\/run-a-node(\/[\w-]+)*(\?|#|$)/, NAVIGATION);
});

// Teleporter is the old name of the ICM contracts. The search lists Avalanche CLI tutorials first
// (/docs/tooling/...). The pages that explain Teleporter are under /docs/cross-chain and in the Academy ICM
// lessons. A search row shows a title and a line of text but no path, so "What is ICM Contracts?" (docs) and
// "What is Interchain Messaging?" (Academy) are equally good answers, and the agent picks either one.
test('docs search leads a visitor from "teleporter" to a page that explains Teleporter', async (fixtures) => {
  needsModel();
  const { app, agent, browser } = fixtures;
  await openDocsPage(app, browser, '/docs/primary-network');
  await desktopOnly(browser, 'docs/search.e2e.ts tests the phone search');
  // The result must open on the site under test, not on build.avax.network.
  const origin = await browser.evaluate(() => location.origin);
  await agent.act('use the docs search to look up teleporter, and open the result that explains what Teleporter is');
  await expect(browser).toHaveURL(
    new RegExp(`^${origin.replace(/[.:/]/g, '\\$&')}/(docs/cross-chain|academy)/`),
    NAVIGATION,
  );
});
