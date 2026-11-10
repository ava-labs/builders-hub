import { test } from '@e2e-dev/web';
import { expect } from 'e2e';
import { DATA, MULTI_PAGE, NAVIGATION } from '../explorer/explorer-page';
import { desktopOnly, needsModel } from '../lib/skip';
import { waitForHydration } from '../lib/hydration';

const NODE_ID = /NodeID-[1-9A-HJ-NP-Za-km-z]+/;

// The visitor asks for the stake ranking, not for a tab. The overview has no ranking, so the agent must find
// the validators list. The ranking is live, so a locator opens the top row: an agent pick of that row never
// replays, because each row link's name holds live numbers (components/explorer-v2/staking/PrimaryValidators.tsx:635).
test('visitor finds the validator stake ranking from the P-Chain overview and opens the top validator', MULTI_PAGE, async (fixtures) => {
  needsModel();
  const { app, agent, browser, screen } = fixtures;
  await app.open('/explorer/mainnet/p-chain');
  await desktopOnly(browser, 'explorer/pages.e2e.ts tests the phone layout of these pages');
  await waitForHydration(browser, '#nd-nav');
  await agent.act('open the list that ranks the Primary Network validators by stake');
  await expect(browser).toHaveURL(/\/explorer\/mainnet\/p-chain\/validators(\?|$)/, NAVIGATION);
  // The list sorts by total stake, largest first.
  await expect(screen.getByRole('button', 'Total Stake ↓')).toBeVisible();
  // The rank cell shows on desktop only, so the name of the first row starts with "1 ".
  const top = screen.getByRole('link', new RegExp(`^1 .*${NODE_ID.source}`));
  // The rows load from the data API after the header renders.
  await expect(top).toBeVisible(DATA);
  // The row title is the NodeID, then " · " and the IP when the crawler knows it.
  const nodeId = ((await top.getAttribute('title')) ?? '').split(' · ')[0];
  expect(nodeId).toMatch(new RegExp(`^${NODE_ID.source}$`));
  await top.tap();
  await expect(browser).toHaveURL(new RegExp(`/explorer/mainnet/p-chain/node/${nodeId}(\\?|$)`), NAVIGATION);
  // The node page names its node in a copy button.
  await expect(screen.getByRole('button', nodeId)).toBeVisible();
});

// The City view (/explorer/mainnet/chains) draws the L1s in 3D, with a chain list and a search over it.
// Two acts, each with its own check, so the URL proves that the agent went through the City view.
// The second act asks for the search: the list buttons name live counts ("Chains 68" in SidebarHead,
// components/explorer-v2/network/city-frame.tsx, and "Dexalot 10" in RowButton, city-app.tsx), so a replay through the
// list stops when a count changes.
test('visitor opens an L1 from the City view of the explorer', MULTI_PAGE, async (fixtures) => {
  needsModel();
  const { app, agent, browser, screen } = fixtures;
  await app.open('/explorer/mainnet');
  await desktopOnly(browser, 'the City view has its own phone layout');
  await waitForHydration(browser, '#nd-nav');
  await agent.act('open the City view');
  await expect(browser).toHaveURL(/\/explorer\/mainnet\/chains(\?|$)/, NAVIGATION);
  // A replayed step types once with no second try, so wait until the search box is live.
  await waitForHydration(browser, 'input[placeholder^="Search or ask"]');
  await agent.act('search the City view for Dexalot and open the Dexalot explorer');
  await expect(browser).toHaveURL(/\/explorer\/mainnet\/dexalot(\?|$)/, NAVIGATION);
  await expect(screen.getByRole('heading', 'Dexalot Explorer', { level: 1 })).toBeVisible();
});
