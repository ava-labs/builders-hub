import { test, type Browser } from '@e2e-dev/web';
import { expect } from 'e2e';
import { waitForHydration } from '../lib/hydration';
import { phoneOnly } from '../lib/skip';
import { NAVIGATION, openDocsPage } from './docs-page';

// The navbar button reads "Search ⌘ K" on desktop and "Open Search" on phone.
const SEARCH_BUTTON = /^(Open Search|Search)/;
const QUESTION = 'how much AVAX do I need to stake';

// The chat gets a fake answer, so no test makes an AI call. Returns the request bodies the chat sends.
async function fakeChat(browser: Browser): Promise<string[]> {
  const asked: string[] = [];
  await browser.route(/\/api\/chat([?#]|$)/, (route) => {
    asked.push(route.request.postData ?? '');
    return route.fulfill({ status: 503, json: { message: 'The test chat has no answer.' } });
  });
  return asked;
}

test('search finds a docs page and opens it', async ({ app, screen, browser }) => {
  await openDocsPage(app, browser, '/docs/primary-network');
  await screen.getByRole('button', SEARCH_BUTTON).tap();
  const dialog = screen.getByRole('dialog', 'Search');
  await expect(dialog).toBeVisible();
  await dialog.getByRole('textbox', 'Search').fill('ICM Contract Addresses');
  // The page row carries the page title, under a line that says where the page lives.
  // The section rows under it carry other text.
  const result = dialog.getByRole('button', /ICM Contract Addresses$/);
  await expect(result).toBeVisible();
  // The query is the page title, so the page comes first, and the first page row always shows the line.
  await expect(result).toContainText('Docs › Cross-Chain › ICM Contracts');
  await result.tap();
  // A relative URL must match on the site under test. A result that opens build.avax.network fails.
  await expect(browser).toHaveURL('/docs/cross-chain/icm-contracts/addresses', NAVIGATION);
  await expect(screen.getByRole('heading', 'ICM Contract Addresses', { level: 1 })).toBeVisible();
  await expect(dialog).toBeHidden();
});

test('keyboard shortcut opens search and Escape closes it', async ({ app, screen, browser }) => {
  await openDocsPage(app, browser, '/docs/primary-network');
  await browser.keyboard.press('ControlOrMeta+k');
  const dialog = screen.getByRole('dialog', 'Search');
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('textbox', 'Search')).toBeFocused();
  await browser.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
});

test('a task search offers the Console tool that does it', async ({ app, screen, browser }) => {
  await openDocsPage(app, browser, '/docs/primary-network');
  await screen.getByRole('button', SEARCH_BUTTON).tap();
  const dialog = screen.getByRole('dialog', 'Search');
  await dialog.getByRole('textbox', 'Search').fill('faucet');
  // A tool row reads like a page row: where it lives, then its name.
  const tool = dialog.getByRole('button', /Testnet Faucet$/);
  await expect(tool).toContainText('Console › Primary Network');
  await tool.tap();
  await expect(browser).toHaveURL('/console/primary-network/faucet', NAVIGATION);
});

test('a renamed term leads to its page, with the new name under it', async ({ app, screen, browser }) => {
  await openDocsPage(app, browser, '/docs/primary-network');
  await screen.getByRole('button', SEARCH_BUTTON).tap();
  const dialog = screen.getByRole('dialog', 'Search');
  await dialog.getByRole('textbox', 'Search').fill('subnet');
  await expect(dialog.getByRole('button', /Avalanche L1s$/)).toBeVisible();
  await dialog.getByRole('button', 'Subnets are now called L1s.').tap();
  await expect(browser).toHaveURL('/docs/avalanche-l1s', NAVIGATION);
});

test('a question goes from the search to the chat', async ({ app, screen, browser }) => {
  const asked = await fakeChat(browser);
  await openDocsPage(app, browser, '/docs/primary-network');
  await screen.getByRole('button', SEARCH_BUTTON).tap();
  const dialog = screen.getByRole('dialog', 'Search');
  await dialog.getByRole('textbox', 'Search').fill(QUESTION);
  await dialog.getByRole('button', /Ask AI$/).tap();
  await expect(dialog).toBeHidden();
  // The chat bubble on the page takes the question and shows the chat's answer.
  await expect(screen.getByText('The test chat has no answer.')).toBeVisible();
  expect(asked.join('\n')).toContain(QUESTION);
});

test('on the chat page, a question from the search goes into the open chat', async ({ app, screen, browser }) => {
  const asked = await fakeChat(browser);
  await app.open('/chat');
  // A chat that already holds a message: /chat?q= only starts an empty one.
  await waitForHydration(browser, 'textarea[placeholder="Ask anything about Avalanche..."]');
  await screen.getByPlaceholder('Ask anything about Avalanche...').fill('What is the C-Chain?');
  await browser.keyboard.press('Enter');
  await expect.poll(() => asked.length).toBe(1);
  await screen.getByRole('button', SEARCH_BUTTON).tap();
  const dialog = screen.getByRole('dialog', 'Search');
  await dialog.getByRole('textbox', 'Search').fill(QUESTION);
  await dialog.getByRole('button', /Ask AI$/).tap();
  // The question shows in this chat, which sent it: not the bubble (absent here), not a reload with ?q=.
  await expect(screen.getByText(QUESTION)).toBeVisible();
  await expect.poll(() => asked.length).toBe(2);
  expect(asked[1]).toContain(QUESTION);
  expect(asked[1]).not.toContain('"source":"bubble"');
  await expect(browser).toHaveURL('/chat');
});

test('where no chat bubble shows, a question from the search opens the chat page', async ({ app, screen, browser }) => {
  const asked = await fakeChat(browser);
  await app.open('/explorer/mainnet');
  await phoneOnly(browser, 'the explorer hides the chat bubble on phones only');
  // The explorer has its own search button too, so name the navbar's exactly.
  await waitForHydration(browser, 'button[aria-label="Open Search"]');
  await screen.getByRole('button', 'Open Search').tap();
  const dialog = screen.getByRole('dialog', 'Search');
  await dialog.getByRole('textbox', 'Search').fill(QUESTION);
  await dialog.getByRole('button', /Ask AI$/).tap();
  await expect(browser).toHaveURL(`/chat?q=${encodeURIComponent(QUESTION)}`, NAVIGATION);
  await expect.poll(() => asked.join('\n')).toContain(QUESTION);
});
