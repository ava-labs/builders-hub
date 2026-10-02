import { test } from '@e2e-dev/web';
import { expect } from 'e2e';
import { isPhoneLayout } from '../lib/skip';

test('theme toggle switches the html class between light and dark', async ({ app, screen, browser }) => {
  await app.open('/grants');
  // On the phone the toggle is in the menu sheet.
  if (await isPhoneLayout(browser)) {
    await screen.getByRole('button', 'Toggle Menu').tap();
  }
  const toggle = screen.getByRole('button', 'Toggle Theme');
  const html = browser.locator('html');
  const startsDark = await browser.evaluate(() => document.documentElement.classList.contains('dark'));
  const [first, second] = startsDark ? [/\blight\b/, /\bdark\b/] : [/\bdark\b/, /\blight\b/];

  await toggle.tap();
  await expect(browser).toHaveClass(html, first);
  await toggle.tap();
  await expect(browser).toHaveClass(html, second);
});
