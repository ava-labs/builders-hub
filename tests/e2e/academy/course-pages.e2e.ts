import { test } from '@e2e-dev/web';
import { expect } from 'e2e';
import { waitForHydration } from '../lib/hydration';

// These course pages have an "Avalanche" heading. Its id="avalanche" makes the heading element
// window.avalanche, the name of the Core wallet provider. A direct load must not take it for a wallet.
for (const path of ['/academy/avalanche-l1/interchain-messaging', '/academy/avalanche-l1/customizing-evm']) {
  test(`${path} opens on a direct load`, async ({ app, screen, browser }) => {
    await app.open(path);
    // The crash happened in the browser, after hydration.
    await waitForHydration(browser, 'body');
    await expect(screen.getByRole('heading', 'Modules', { level: 2 })).toBeVisible();
    await expect(screen.getByText('Oops! Something went wrong')).toBeHidden();
  });
}
