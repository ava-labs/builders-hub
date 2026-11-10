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
  // Below 640 px the chain switcher sits at the left of the site header, and the time range ends the tab row.
  const phone = await isPhoneLayout(browser);
  const phoneNormal = [
    // components/explorer-v2/ExplorerSubnav.tsx:544: the tab row scrolls sideways (overflow-x: auto).
    'The row of section tabs scrolls sideways and stops before the time range picker at its right end, so a tab next to the picker can be cut on purpose.',
    'A search box placeholder can end at the edge of its box.',
  ];
  const subject = phone
    ? 'the site header, with the chain switcher (chain name over network name) left of the centered logo, and under it the explorer section tabs with a time range picker at their right end'
    : 'the site header and the explorer section tabs';
  await agent.assert(layoutIsIntact(subject, phone ? phoneNormal : []), SCREENSHOT_ONLY);
});
