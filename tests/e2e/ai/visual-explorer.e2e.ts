import { test } from '@e2e-dev/web';
import { expect } from 'e2e';
import { DATA, OVERVIEW_BLOCK_ROW } from '../explorer/explorer-page';
import { isPhoneLayout, needsModel } from '../lib/skip';
import { waitForHydration } from '../lib/hydration';
import { openAsReturningVisitor } from '../site/helpers';
import { SCREENSHOT_ONLY, VISUAL, layoutIsIntact, waitForStillScreen } from './visual';

// The values are live. The judge checks the layout only, never a number.
test('explorer c-chain overview is laid out without clipped or overlapping content', VISUAL, async (fixtures) => {
  needsModel();
  const { app, agent, browser, screen } = fixtures;
  await openAsReturningVisitor(app, browser, '/explorer/mainnet/c-chain');
  await waitForHydration(browser, '#nd-nav');
  // The rows load from the data API after the page renders. Wait for them, so the judge reads the filled page.
  await expect(screen.getByRole('link', OVERVIEW_BLOCK_ROW).first()).toBeVisible(DATA);
  await waitForStillScreen(browser);
  // At 1440 px every tab and the whole placeholder fit, so a cut there is a fault. Excuse them on the phone only.
  const phoneNormal = [
    // components/explorer-v2/ExplorerSubnav.tsx:494: the tab row scrolls sideways (overflow-x: auto).
    'The row of section tabs scrolls sideways, so a tab at its right end can be cut on purpose.',
    'A search box placeholder can end at the edge of its box.',
  ];
  await agent.assert(
    layoutIsIntact('the site header and the explorer section tabs', (await isPhoneLayout(browser)) ? phoneNormal : []),
    SCREENSHOT_ONLY,
  );
});
