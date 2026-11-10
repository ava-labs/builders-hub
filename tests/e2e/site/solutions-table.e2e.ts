import { test } from '@e2e-dev/web';
import { expect } from 'e2e';
import { isPhoneLayout } from '../lib/skip';
import { openAsReturningVisitor } from './helpers';

// The decision table at the bottom of /solutions: one row for each decision, with a C-Chain value and an L1 value.
// The navbar and the subnav stick to the top of the screen and cover about 90 px of it.
const STICKY_HEADER_HEIGHT = 90;

test('solutions decision table fits the screen', async ({ app, screen, browser }) => {
  await openAsReturningVisitor(app, browser, '/solutions');
  const table = screen.getByRole('table', /^Start on the C-Chain\./);
  await table.scrollIntoView();
  await expect(table.getByRole('columnheader', /^C-Chain/)).toBeVisible();
  await expect(table.getByRole('columnheader', /^Your own L1/)).toBeVisible();
  await expect(table.getByRole('rowheader', 'Finality')).toBeVisible();

  const box = await table.boundingBox();
  const viewport = await browser.evaluate(() => ({ width: window.innerWidth, height: window.innerHeight }));
  expect(box).not.toBeNull();
  // A row shows its label and its two values without a sideways scroll.
  expect(box!.width).toBeLessThanOrEqual(viewport.width);
  // No row holds text or a button that goes past the edge of the row. The section clips overflow, so that text is cut off.
  const cutOffRows = await browser.evaluate(
    () => [...document.querySelectorAll('table tr')].filter((row) => row.scrollWidth > row.clientWidth).length,
  );
  expect(cutOffRows).toBe(0);
  // On a desktop, all the rows show in one view.
  if (!(await isPhoneLayout(browser))) expect(box!.height).toBeLessThanOrEqual(viewport.height - STICKY_HEADER_HEIGHT);
});
