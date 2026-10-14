import { test } from '@e2e-dev/web';
import { expect } from 'e2e';
import { isPhoneLayout, needsModel } from '../lib/skip';
import { openAsReturningVisitor } from '../site/helpers';
import { SCREENSHOT_ONLY, VISUAL, layoutIsIntact, waitForStillScreen } from './visual';

// Without a wallet the faucet shows its requirements gate in place of the tool.
test('faucet without a wallet is laid out without clipped or overlapping content', VISUAL, async (fixtures) => {
  needsModel();
  const { app, agent, browser, screen } = fixtures;
  await openAsReturningVisitor(app, browser, '/console/primary-network/faucet');
  const gate = browser.locator('[data-console-tool-gate]');
  await expect(gate.getByRole('heading', 'To use this tool you need:')).toBeVisible();
  // The header wallet button renders on the client only, so it shows that React has hydrated the page.
  await expect(screen.getByRole('button', 'Connect wallet')).toBeVisible();
  await waitForStillScreen(browser);
  // Below 640 px the header shows the button as a wallet icon only (its accessible name stays 'Connect wallet').
  const wallet = (await isPhoneLayout(browser))
    ? 'its wallet button (an icon-only square with a wallet icon)'
    : 'its "Connect wallet" button';
  await agent.assert(
    layoutIsIntact(`the console header with ${wallet} and the box listing what the tool needs, all fully visible`),
    SCREENSHOT_ONLY,
  );
});
