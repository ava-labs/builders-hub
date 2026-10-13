import { test } from '@e2e-dev/web';
import { expect } from 'e2e';
import { DATA, NAVIGATION } from './explorer-page';

// Rule: the Query page's prompt box grows with the question, so a question of a few lines reads whole,
// with no scroll inside the box. The box is PromptBox in components/explorer-v2/evm/QueryWorking.tsx.
// On a phone its text is at least 16px: iOS Safari zooms the page into any field with smaller text.

const PATH = '/explorer/mainnet/c-chain/query';
const QUESTION =
  'Give me a stacked 7-day trailing average of the C-Chain transaction fees split by the top 5 contracts by fees paid, and the rest as other, over the last 90 days';

/** the prompt box's text size and the window's width, in px */
function textPx(): [number, number] {
  const box = document.querySelector('textarea');
  return [box ? parseFloat(getComputedStyle(box).fontSize) : 0, window.innerWidth];
}

/** how far the box's text runs past what the box shows, in px; 0 when the question reads whole */
function hiddenPx(): number {
  const box = document.querySelector('textarea');
  return box ? box.scrollHeight - box.clientHeight : -1;
}

test('a long question grows the prompt box instead of scrolling inside it', { timeout: 180_000 }, async ({ app, screen, browser }) => {
  await app.open(PATH);
  const box = screen.getByRole('textbox', /^Ask (Avalanche )?C-Chain about/);
  await expect(box).toBeVisible(NAVIGATION);
  // typed again until React is live: a value typed before hydration would not grow the box
  await expect
    .poll(async () => {
      await box.fill(QUESTION);
      return browser.evaluate(hiddenPx);
    }, DATA)
    .toBe(0);
});

test('the prompt box text is big enough on a phone that focusing it does not zoom the page', { timeout: 180_000 }, async ({ app, screen, browser }) => {
  await app.open(PATH);
  await expect(screen.getByRole('textbox', /^Ask (Avalanche )?C-Chain about/)).toBeVisible(NAVIGATION);
  const [size, width] = await browser.evaluate(textPx);
  // md (768px) and up has no zoom on focus, and keeps the 13px of the page's other mono text
  if (width < 768) expect(size).toBeGreaterThanOrEqual(16);
});
