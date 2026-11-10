import { test } from '@e2e-dev/web';
import { expect } from 'e2e';

test('grants page opens with its heading', { tags: ['smoke'] }, async ({ app, screen, browser }) => {
  await app.open('/grants');
  await expect(browser).toHaveTitle('Grants | Avalanche Builder Hub');
  await expect(screen.getByRole('heading', 'Grants', { level: 1 })).toBeVisible();
});

test('events page opens with its heading', async ({ app, screen, browser }) => {
  await app.open('/events');
  await expect(browser).toHaveTitle('Events | Avalanche Builder Hub');
  await expect(screen.getByRole('heading', 'Events', { level: 1 })).toBeVisible();
});

test('guides redirect to the blog list', { tags: ['smoke'] }, async ({ screen, browser }) => {
  // app.open waits for the load event, which waits for every post image. A dev server makes those slowly.
  await browser.goto('/guides', { waitUntil: 'domcontentloaded' });
  await expect(browser).toHaveURL('/blog');
  await expect(browser).toHaveTitle('Blog | Avalanche Builder Hub');
  // The blog heading is for screen readers only. The posts are the visible content.
  await expect(screen.getByRole('heading', 'Blog', { level: 1 })).toBeAttached();
  await expect(browser.locator('main a[href^="/blog/"]').first()).toBeVisible();
});

test('missing route shows the 404 page', async ({ app, screen, browser }) => {
  const path = '/e2e-route-that-does-not-exist';
  await app.open(path);
  await expect(screen.getByRole('heading', "Oops! This page doesn't exist", { level: 1 })).toBeVisible();
  await expect(screen.getByRole('link', 'Back to Home')).toHaveAttribute('href', '/');
  // Search engines read the status code, not the page.
  const status = await browser.evaluate(async (url: string) => (await fetch(url)).status, path);
  expect(status).toBe(404);
});
