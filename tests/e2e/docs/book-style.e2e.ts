import { test } from '@e2e-dev/web';
import { expect } from 'e2e';
import { desktopOnly } from '../lib/skip';
import { openDocsPage } from './docs-page';

// The page has two callouts, one figure and color-key terms (<Term>), so it shows each part of the book style.
const REWARD_MANAGER = '/docs/avalanche-l1s/precompiles/reward-manager';

// The figure caption without its number. figure.css adds "Figure n" from a CSS counter, and a counter adds no text
// to the accessible name, so the name starts with the sentence.
const FIGURE_CAPTION = /^The Reward Manager sends the fees of each block on one of three routes\./;

// The color key toggle saves the choice under this localStorage key.
const COLOR_KEY_STORAGE = 'docs-colorkey';

test('callouts are notes with the name of their label', async ({ app, screen, browser }) => {
  await openDocsPage(app, browser, REWARD_MANAGER);
  // The framework has no "note" role, so the test finds each callout by its name (aria-label) and then checks the role.
  // The page has two notes with the name "Note". The text of the body selects one.
  const note = screen.getByLabel('Note').filter({ hasText: 'If the precompile is not active' });
  await expect(note).toBeVisible();
  await expect(note).toHaveAttribute('role', 'note');

  const warning = screen.getByLabel('Warning');
  await expect(warning).toBeVisible();
  await expect(warning).toHaveAttribute('role', 'note');
  await expect(warning).toContainText('Who can change the fee route?');
});

test('figure caption has the figure number', async ({ app, screen, browser }) => {
  await openDocsPage(app, browser, REWARD_MANAGER);
  const figure = screen.getByRole('figure', FIGURE_CAPTION);
  await expect(figure).toBeVisible();
  // The number is not text of the page, so the test reads the CSS that draws it.
  // It also counts the elements that step the counter: code blocks are figures too, and they must not count.
  const counter = await browser.evaluate(() => {
    const figure = document.getElementById('fee-routes');
    const caption = figure?.querySelector(':scope > figcaption');
    const article = figure?.closest('article');
    if (!figure || !caption || !article) return null;
    const steps = [...article.querySelectorAll('*')].filter((el) =>
      getComputedStyle(el).counterIncrement.startsWith('bk-figure'),
    );
    return {
      content: getComputedStyle(caption, '::before').content,
      reset: getComputedStyle(article).counterReset,
      number: steps.indexOf(figure) + 1,
    };
  });
  expect(counter).toEqual({ content: '"Figure " counter(bk-figure)', reset: 'bk-figure 0', number: 1 });
});

test('color key switch turns the role colors off and on', async ({ app, screen, browser }) => {
  await openDocsPage(app, browser, REWARD_MANAGER);
  await desktopOnly(browser, 'the switch shows in the table of contents rail on desktop only');
  try {
    const colorKey = screen.getByRole('switch', 'Color key');
    const html = browser.locator('html');
    await expect(colorKey).toBeChecked();
    await expect(html).not.toHaveAttribute('data-colorkey');

    await colorKey.tap();
    await expect(colorKey).not.toBeChecked();
    await expect(html).toHaveAttribute('data-colorkey', 'off');

    await colorKey.tap();
    await expect(colorKey).toBeChecked();
    await expect(html).not.toHaveAttribute('data-colorkey');
  } finally {
    // The toggle saves the choice. Remove it, so that the next test starts with the color key on.
    await browser.evaluate((key) => {
      localStorage.removeItem(key);
      return null;
    }, COLOR_KEY_STORAGE);
  }
});

test('shell code block copies the command without the prompt', async ({ app, screen, browser }) => {
  await openDocsPage(app, browser, '/docs/tooling/contract-verification');
  // The test browser has no clipboard permission, so a stub records what the page writes.
  await browser.evaluate(() => {
    const record = window as unknown as { copied: string | null };
    record.copied = null;
    navigator.clipboard.writeText = async (text: string) => {
      record.copied = text;
    };
    return null;
  });
  // Two blocks run forge verify-contract. The custom verifier flag selects the first one.
  const block = screen.getByRole('figure').filter({ hasText: '--verifier custom' });
  // code.css draws the "$ " prompt before each command line. It must not go into the copied text.
  await block.getByRole('button', 'Copy Text').tap();
  await expect(block.getByRole('button', 'Copied Text')).toBeVisible();
  const copied = await browser.evaluate(() => (window as unknown as { copied: string | null }).copied);
  expect(copied).toMatch(/^forge verify-contract /);
});
