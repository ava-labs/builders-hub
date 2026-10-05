import { test } from '@e2e-dev/web';
import { expect } from 'e2e';
import { desktopOnly } from '../lib/skip';
import { closeTableOfContents, openDocsPage, openTableOfContents } from './docs-page';

test('code tabs switch the install command', async ({ app, screen, browser }) => {
  await openDocsPage(app, browser, '/docs/tooling/avalanche-sdk');
  const npm = screen.getByRole('tab', 'npm');
  const pnpm = screen.getByRole('tab', 'pnpm');
  await expect(npm).toBeSelected();
  await expect(screen.getByRole('tabpanel', 'npm')).toContainText('npm install @avalanche-sdk/client');

  await pnpm.tap();
  await expect(pnpm).toBeSelected();
  await expect(npm).not.toBeSelected();
  await expect(screen.getByRole('tabpanel', 'pnpm')).toContainText('pnpm add @avalanche-sdk/client');
  await expect(screen.getByRole('tabpanel', 'npm')).toBeHidden();
});

test('code block copy button copies the command', async ({ app, screen, browser }) => {
  await openDocsPage(app, browser, '/docs/tooling/avalanche-sdk');
  // The test browser has no clipboard permission, so a stub records what the page writes.
  await browser.evaluate(() => {
    const record = window as unknown as { copied: string | null };
    record.copied = null;
    navigator.clipboard.writeText = async (text: string) => {
      record.copied = text;
    };
    return null;
  });
  const panel = screen.getByRole('tabpanel', 'npm');
  await panel.getByRole('button', 'Copy Text').tap();
  await expect(panel.getByRole('button', 'Copied Text')).toBeVisible();
  const copied = await browser.evaluate(() => (window as unknown as { copied: string | null }).copied);
  expect(copied?.trim()).toBe('npm install @avalanche-sdk/client');
});

test('table of contents jumps to a heading', async ({ app, screen, browser }) => {
  await openDocsPage(app, browser, '/docs/primary-network');
  // The page headings carry anchor links with the same names, so look only in the table of contents.
  const toc = await openTableOfContents(browser);
  await toc.getByRole('link', 'P-Chain (Platform Chain)').tap();
  await expect(browser).toHaveURL('/docs/primary-network#p-chain-platform-chain');
  await expect(screen.getByRole('heading', 'P-Chain (Platform Chain)', { level: 3 })).toBeVisible();
  await expect
    .poll(() =>
      browser.evaluate(() => {
        const top = document.getElementById('p-chain-platform-chain')?.getBoundingClientRect().top ?? -1;
        return top >= 0 && top < window.innerHeight / 2;
      }),
    )
    .toBe(true);
});

test('heading after a table of contents jump is not under the fixed bars', async ({ app, browser }) => {
  await openDocsPage(app, browser, '/docs/primary-network');
  const toc = await openTableOfContents(browser);
  await toc.getByRole('link', 'P-Chain (Platform Chain)').tap();
  await expect(browser).toHaveURL('/docs/primary-network#p-chain-platform-chain');
  await closeTableOfContents(browser);
  // The middle of the heading text must show the heading, not a bar on top of it.
  await expect
    .poll(() =>
      browser.evaluate(() => {
        const text = document.querySelector('#p-chain-platform-chain > a');
        if (!text) return 'no heading';
        const box = text.getBoundingClientRect();
        const top = document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2);
        return top && text.contains(top) ? 'heading' : `covered by ${top?.closest('[id]')?.id ?? top?.tagName}`;
      }),
    )
    .toBe('heading');
});

test('report issue link names the docs page', async ({ app, screen, browser }) => {
  await openDocsPage(app, browser, '/docs/primary-network');
  await desktopOnly(browser, 'the page actions rail shows on desktop only');
  const href = await screen.getByRole('link', 'Report Issue').getAttribute('href');
  const body = new URL(href ?? '').searchParams.get('body') ?? '';
  expect(body).toContain('(https://build.avax.network/docs/primary-network)');
});

test('copy markdown fallback copies the docs page URL', async ({ app, browser }) => {
  await openDocsPage(app, browser, '/docs/primary-network');
  await desktopOnly(browser, 'the page actions rail shows on desktop only');
  // The feedback block under the article has its own Copy Markdown button, so look only in the rail.
  const rail = await openTableOfContents(browser);
  // The button copies the page URL when the markdown request fails.
  // A stub fails the markdown request, and a clipboard stub records what the page writes.
  await browser.evaluate(() => {
    const record = window as unknown as { copied: string | null };
    record.copied = null;
    const fetchPage = window.fetch.bind(window);
    window.fetch = (input, init) =>
      String(input).endsWith('.md') ? Promise.resolve(new Response(null, { status: 500 })) : fetchPage(input, init);
    navigator.clipboard.writeText = async (text: string) => {
      record.copied = text;
    };
    return null;
  });
  await rail.getByRole('button', 'Copy Markdown').tap();
  await expect(rail.getByRole('button', 'Copied!')).toBeVisible();
  const copied = await browser.evaluate(() => (window as unknown as { copied: string | null }).copied);
  expect(copied).toBe(await browser.evaluate(() => `${window.location.origin}/docs/primary-network`));
});
