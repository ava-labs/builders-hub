import { test } from '@e2e-dev/web';
import { expect } from 'e2e';
import { NAVIGATION_TIMEOUT, TWO_ROUTE_TIMEOUT } from './helpers';

test('home page shows the site title and hero heading', async ({ app, screen, browser }) => {
  await app.open('/');
  await expect(browser).toHaveTitle('Avalanche Builder Hub');
  // The last word of the heading changes every few seconds. Match the shape of the sentence.
  await expect(screen.getByRole('heading', /^Build an? [a-z]+ ?\.$/, { level: 1 })).toBeVisible();
});

test('hero calls to action link where they claim', { timeout: TWO_ROUTE_TIMEOUT }, async ({ app, browser }) => {
  await app.open('/');
  // Other sections repeat the same labels, so look only in the hero.
  const hero = browser.locator('[data-chapter="hero"]');
  await expect(hero.getByRole('link', 'Build on C-Chain')).toHaveAttribute('href', '/docs/quick-start');
  await expect(hero.getByRole('link', 'READ THE ARCHITECTURE →')).toHaveAttribute('href', '/docs/avalanche-l1s');

  await hero.getByRole('link', 'Build an L1').tap();
  await expect(browser).toHaveURL('/console', { timeout: NAVIGATION_TIMEOUT });
  await expect(browser).toHaveTitle('Console | Avalanche Builder Hub');
});
