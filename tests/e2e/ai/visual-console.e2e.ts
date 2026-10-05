import { test } from '@e2e-dev/web';
import { expect } from 'e2e';
import { needsModel } from '../lib/skip';
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
  await expect(screen.getByRole('button', 'Connect Wallet')).toBeVisible();
  await waitForStillScreen(browser);
  await agent.assert(
    layoutIsIntact(
      'the console header with its "Connect Wallet" button and the box listing what the tool needs, all fully visible',
    ),
    SCREENSHOT_ONLY,
  );
});
