import { test } from '@e2e-dev/web';
import { expect } from 'e2e';
import { desktopOnly, needsModel } from '../lib/skip';
import { openAsReturningVisitor } from '../site/helpers';

// A visitor without a wallet opens a tool that needs one. The page must say what to do, and it must not look broken.
// A locator finds the gate. Only a reader can tell that nothing else on the page is an error.
test('stake tool asks a visitor without a wallet to connect one, and shows no error', async (fixtures) => {
  needsModel();
  const { app, agent, browser } = fixtures;
  await openAsReturningVisitor(app, browser, '/console/primary-network/stake');
  await desktopOnly(browser, 'site/console.e2e.ts tests the wallet gate at both sizes');
  const gate = browser.locator('[data-console-tool-gate]');
  await expect(gate.getByRole('heading', 'To use this tool you need:')).toBeVisible();
  await agent.assert('the page asks the visitor to connect a wallet before they can use the staking tool');
  await agent.assert('nothing on the page is an error message or a failed load');
});
