import { test } from '@e2e-dev/web';
import { expect } from 'e2e';
import { desktopOnly, needsModel } from '../lib/skip';
import { waitForHydration } from '../lib/hydration';
import { openAsReturningVisitor } from '../site/helpers';

// 1 AVAX = 10^9 nAVAX = 10^18 wei. site/console.e2e.ts types whole AVAX with a locator.
// Here the agent picks the field from the unit name, so a wrong field shows in the AVAX value.
// nAVAX to AVAX also takes the path that writes a fraction (2.5), which the AVAX direction does not.
// The act replays from the cache with no model call, and locators read the exact values.
test('agent converts 2500000000 nAVAX to 2.5 AVAX with the unit converter', async (fixtures) => {
  needsModel();
  const { app, agent, browser, screen } = fixtures;
  await openAsReturningVisitor(app, browser, '/console/primary-network/unit-converter');
  await desktopOnly(browser, 'the conversion is the same at both sizes');
  // A value typed before hydration is lost on the first render.
  await waitForHydration(browser, 'input[aria-label="nAVAX amount"]');
  await agent.act('enter {amount} nAVAX in the unit converter', { params: { amount: '2500000000' } });
  await expect(screen.getByRole('textbox', 'nAVAX amount')).toHaveValue('2500000000');
  await expect(screen.getByRole('textbox', 'AVAX amount')).toHaveValue('2.5');
  await expect(screen.getByRole('textbox', 'Wei amount')).toHaveValue('2500000000000000000');
});
