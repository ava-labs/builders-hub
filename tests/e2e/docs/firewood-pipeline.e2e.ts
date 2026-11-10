import { test } from '@e2e-dev/web';
import { expect } from 'e2e';
import { openDocsPage } from './docs-page';

// "Where Firewood fits." (components/firewood/PipelineIntegration.tsx) shows three callouts under the Firewood
// stage while a pointer is on it. The callouts are absolutely positioned, so only the bottom padding of the
// diagram keeps them inside the grey card.
const CALLOUTS = ['No compaction pauses', 'Native trie I/O', 'Parallel hashing'];

test('firewood pipeline callouts stay inside their card', async ({ app, browser }) => {
  await openDocsPage(app, browser, '/docs/primary-network/firewood');
  const card = browser.locator('xpath=//h3[normalize-space()="Where Firewood fits."]/..');
  await card.scrollIntoView();
  await card.getByText('Firewood').hover();

  const cardBox = await card.boundingBox();
  expect(cardBox).not.toBeNull();
  for (const text of CALLOUTS) {
    const callout = card.getByText(text);
    await expect(callout).toBeVisible();
    const box = await callout.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.y + box!.height).toBeLessThanOrEqual(cardBox!.y + cardBox!.height);
    expect(box!.x).toBeGreaterThanOrEqual(cardBox!.x);
    expect(box!.x + box!.width).toBeLessThanOrEqual(cardBox!.x + cardBox!.width);
  }
});
