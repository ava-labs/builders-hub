import { test } from '@e2e-dev/web';
import { expect } from 'e2e';

// /solutions was removed. A visitor who opens it lands on the Avalanche L1 docs.
// api/solutions-redirects.e2e.ts checks the status and the target of each removed page.
test('solutions opens the Avalanche L1 docs', async ({ screen, browser }) => {
  await browser.goto('/solutions', { waitUntil: 'domcontentloaded' });
  await expect(browser).toHaveURL('/docs/avalanche-l1s');
  await expect(browser).toHaveTitle('Avalanche L1s | Avalanche Builder Hub');
  await expect(screen.getByRole('heading', 'Avalanche L1s', { level: 1 })).toBeVisible();
});
