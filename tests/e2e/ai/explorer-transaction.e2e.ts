import { test } from '@e2e-dev/web';
import { expect } from 'e2e';
import { DATA, MULTI_PAGE, NAVIGATION } from '../explorer/explorer-page';
import { desktopOnly, needsModel } from '../lib/skip';
import { waitForHydration } from '../lib/hydration';

// A fixed past block, so the replay cache finds the same transaction links on every run.
// Mainnet C-Chain block 96532770 holds 59 transactions.
const BLOCK = '96532770';

// The agent finds a block with the search box and opens a transaction, as a visitor does.
// The instruction names the search box: the agent may otherwise type the block URL and skip the search.
// The judge then reads the transaction page. A locator finds the labels, but not that the values next to them make sense.
test('explorer search leads to a transaction that shows its sender, recipient and value', MULTI_PAGE, async (fixtures) => {
  needsModel();
  const { app, agent, browser, screen } = fixtures;
  // The tx page reads its trace from stats-api after it renders, and a loaded trace adds a calls count to the page.
  // That read is live: a late or refused trace left the count out, and the replay of the act step failed its end check
  // (master E2E, 2026-10-27). The step and the judge read the receipt only, so the trace gets the answer the route
  // gives a tx with no trace (a soft 404, no_index), and the page shows the same receipt view on every run.
  await browser.route(/\/api\/trace\//, async (route) => {
    await route.fulfill({ headers: { 'x-status': '404', 'cache-control': 'no-store' }, json: { error: 'no_index' } });
  });
  await app.open('/explorer/mainnet/c-chain');
  await desktopOnly(browser, 'explorer/pages.e2e.ts tests the phone layout of these pages');
  await waitForHydration(browser, '#nd-nav');
  await agent.act('use the search box to open block {block}, then open the first transaction listed in that block', {
    params: { block: BLOCK },
  });
  await expect(browser).toHaveURL(/\/explorer\/mainnet\/c-chain\/tx\/0x[0-9a-f]{64}$/, NAVIGATION);
  // The details load in the browser after the page renders. The judge reads one screen, so wait for them first.
  await expect(screen.getByText('Nonce')).toBeVisible(DATA);
  await agent.assert('the page shows the transaction sender address, the recipient address and the value transferred');
});
