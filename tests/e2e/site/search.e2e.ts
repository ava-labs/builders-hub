import { test } from '@e2e-dev/web';
import type { Browser } from '@e2e-dev/web';
import { expect } from 'e2e';
import { desktopOnly } from '../lib/skip';
import { waitForHydration } from '../lib/hydration';
import { openAsReturningVisitor } from './helpers';

// site-search-dialog (components/search.tsx, lib/search/dialog-motion.ts, app/global.css): opened from the keyboard,
// the search shows and leaves in one frame, both its parts (the backdrop and the dialog). Opened with a pointer, both
// parts settle in over 180ms and leave in 120ms; the input that opened the dialog decides its exit too.

const PARTS = '.site-search-overlay, .site-search-content';

/** Records, in ms from page start: the keys and pointer presses, each part's animations, and when parts mount and go. */
function recordSearch(browser: Browser) {
  return browser.evaluate((parts) => {
    const log: { at: number; what: string }[] = [];
    (window as unknown as { __e2eSearch: typeof log }).__e2eSearch = log;
    const at = () => performance.now();
    const part = (node: Element) => (node.classList.contains('site-search-content') ? 'dialog' : 'backdrop');
    document.addEventListener(
      'animationstart',
      (event) => {
        const target = event.target as Element;
        if (target.matches(parts)) log.push({ at: at(), what: `${part(target)} ${event.animationName}` });
      },
      true,
    );
    window.addEventListener('keydown', (event) => log.push({ at: at(), what: `key ${event.key}` }), true);
    new MutationObserver((records) => {
      for (const record of records) {
        for (const node of record.removedNodes) {
          if (!(node instanceof Element)) continue;
          for (const gone of [node, ...node.querySelectorAll(parts)].filter((el) => el.matches(parts))) {
            log.push({ at: at(), what: `${part(gone)} removed` });
          }
        }
      }
    }).observe(document.body, { childList: true, subtree: true });
    return null;
  }, PARTS);
}

function searchLog(browser: Browser) {
  return browser.evaluate(() => (window as unknown as { __e2eSearch: { at: number; what: string }[] }).__e2eSearch);
}

async function openPage(app: Parameters<typeof openAsReturningVisitor>[0], browser: Browser) {
  await openAsReturningVisitor(app, browser, '/grants');
  await desktopOnly(browser, 'the navbar search pill and Cmd K are desktop surfaces');
  // fumadocs listens for Cmd K after hydration.
  await waitForHydration(browser, '#nd-nav button[data-search-full]');
  await recordSearch(browser);
}

test('Cmd K as the first action opens the search with no animation, and Escape closes it at once', async ({
  app,
  screen,
  browser,
}) => {
  await openPage(app, browser);
  await browser.keyboard.press('Meta+k');
  const dialog = screen.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await expect(browser.locator('.site-search-content')).toHaveAttribute('data-instant', '');
  await expect(browser.locator('.site-search-overlay')).toHaveAttribute('data-instant', '');
  const running = await browser.evaluate((parts) => {
    return [...document.querySelectorAll(parts)].flatMap((node) => node.getAnimations().map((a) => a.playState));
  }, PARTS);
  expect(running, 'animations on the backdrop and the dialog').toEqual([]);

  await browser.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  const log = await searchLog(browser);
  // every animation either part started (the backdrop's fades are the shared vs-fade-in and vs-fade-out)
  const animated = log.filter((entry) => /^(dialog|backdrop) (?!removed$)/.test(entry.what));
  expect(animated.map((entry) => entry.what)).toEqual([]);
  const escape = log.find((entry) => entry.what === 'key Escape')!.at;
  const removed = log.filter((entry) => entry.what.endsWith(' removed'));
  expect(removed.map((entry) => entry.what).sort()).toEqual(['backdrop removed', 'dialog removed']);
  // At once: both parts leave within two frames of the key.
  for (const entry of removed) expect(entry.at - escape, entry.what).toBeLessThan(50);
});

test('a click on the search pill opens it with its entrance; Escape plays the exit on both parts', async ({
  app,
  screen,
  browser,
}) => {
  await openPage(app, browser);
  await browser.locator('#nd-nav').getByRole('button', 'Search ⌘ K').tap();
  const dialog = screen.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await expect(browser.locator('.site-search-content')).not.toHaveAttribute('data-instant');
  await expect
    .poll(async () => (await searchLog(browser)).map((entry) => entry.what))
    .toEqual(expect.arrayContaining(['dialog site-search-in', 'backdrop vs-fade-in']));

  await browser.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  const log = await searchLog(browser);
  const escape = log.find((entry) => entry.what === 'key Escape')!.at;
  const after = log.filter((entry) => entry.at >= escape).map((entry) => entry.what);
  expect(after).toEqual(expect.arrayContaining(['dialog site-search-out', 'backdrop vs-fade-out']));
  const removed = log.filter((entry) => entry.what.endsWith(' removed')).map((entry) => entry.at);
  expect(removed).toHaveLength(2);
  // Both parts leave together, once the 120ms exit has played.
  expect(Math.abs(removed[0] - removed[1])).toBeLessThan(50);
  expect(Math.min(...removed) - escape).toBeGreaterThanOrEqual(100);
});
