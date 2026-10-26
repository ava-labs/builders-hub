import { test } from '@e2e-dev/web';
import type { Browser } from '@e2e-dev/web';
import { expect, type App } from 'e2e';
import { desktopOnly } from '../lib/skip';
import { waitForHydration } from '../lib/hydration';

// The network overview's stats (components/explorer-v2/network/NetworkStats.tsx):
// - exp-range-hold: a new range window holds the old figures, dimmed and marked aria-busy, until its data lands; then
//   the figures and the chart cross-fade (the leaving copy goes inert).
// - exp-pick-focus: the readouts are the chart's pickers. They stay mounted through a new window, so the keyboard focus
//   on one stays put, and a focused control in the chart moves to the same control in the arriving copy.
//
// The figures are live, so the test checks focus and state, not values. The window's read is held for 3s so the load
// and the landing can be watched; a keyboard user reaches the readouts some 68 Tab presses after the range control,
// so after the click the test presses Tab once (the keyboard is in use) and moves the focus there directly.

const RANGES = 'Time range for all stats on this page';
/** The metrics read of a window (useChainMetrics, components/explorer-v2/evm/metric-charts.tsx). */
const CHAIN_STATS = /\/api\/chain-stats\//;

/** The focused element: its readout label or link, whether it shows the keyboard ring, whether it sits in a leaving
    (inert) copy, its tag from the test, and the stats body's aria-busy. */
function focusState(browser: Browser) {
  return browser.evaluate(() => {
    const active = document.activeElement as (HTMLElement & { __e2eTag?: string }) | null;
    const body = document.querySelector('[aria-label="Chart Transactions"]')?.closest('[aria-busy]');
    return {
      focused: active?.getAttribute('aria-label') ?? active?.getAttribute('href') ?? active?.tagName ?? null,
      ring: active?.matches(':focus-visible') ?? false,
      inert: Boolean(active?.closest('[inert]')),
      tag: active?.__e2eTag ?? null,
      busy: body?.getAttribute('aria-busy') ?? null,
    };
  });
}

/** Opens the overview with the stats read; returns the switch that holds the next window reads for 3s. */
async function openOverview(app: App, browser: Browser) {
  await app.open('/explorer/mainnet');
  await desktopOnly(browser, 'the range control and the readout row are checked at the desktop size');
  const hold = { on: false };
  await browser.route(CHAIN_STATS, async (route) => {
    if (hold.on) await new Promise((resolve) => setTimeout(resolve, 3_000));
    await route.continue();
  });
  await waitForHydration(browser, '[aria-label="Chart Transactions"]');
  // The opening window has landed: the chart's loading block (animate-pulse) has left the stats body. Until then a
  // new window has nothing to hold.
  await expect
    .poll(
      () =>
        browser.evaluate(() => {
          const body = document.querySelector('[aria-label="Chart Transactions"]')?.closest('[aria-busy]');
          return body ? body.querySelector('.animate-pulse') === null : false;
        }),
      { timeout: 60_000 },
    )
    .toBe(true);
  return hold;
}

test('a readout keeps the keyboard focus while a new window loads and lands', async ({ app, screen, browser }) => {
  const hold = await openOverview(app, browser);
  const ranges = screen.getByRole('radiogroup', RANGES);
  await expect(screen.getByRole('button', 'Chart Transactions')).toHaveAttribute('aria-pressed', 'true');

  // 3M reads a longer span (1y) than the opening window, so its data has to load.
  hold.on = true;
  await ranges.getByRole('radio', '3M').tap();
  await expect(ranges.getByRole('radio', '3M')).toHaveAttribute('aria-checked', 'true');
  await browser.keyboard.press('Tab');
  await browser.evaluate(() => {
    const readout = document.querySelector('[aria-label="Chart Active Addresses"]') as HTMLElement & {
      __e2eTag?: string;
    };
    readout.__e2eTag = 'readout';
    readout.focus();
    return null;
  });
  const loading = await focusState(browser);
  expect(loading.busy, 'the stats body while the window loads').toBe('true');
  expect(loading).toMatchObject({ focused: 'Chart Active Addresses', ring: true });

  // The window lands: the body is no longer busy, and the focus is on the same readout, with its ring.
  await expect.poll(async () => (await focusState(browser)).busy, { timeout: 20_000 }).toBe('false');
  hold.on = false;
  expect(await focusState(browser)).toMatchObject({
    focused: 'Chart Active Addresses',
    ring: true,
    inert: false,
    tag: 'readout',
  });
  await browser.keyboard.press('Tab');
  await expect(screen.getByRole('button', 'Chart Contracts Deployed')).toBeFocused();
});

test('the focused ICM chart link hands its focus to the arriving copy when a window lands', async ({
  app,
  screen,
  browser,
}) => {
  const hold = await openOverview(app, browser);
  const ranges = screen.getByRole('radiogroup', RANGES);
  await screen.getByRole('button', 'Chart ICM Messages').tap();
  await expect(screen.getByRole('button', 'Chart ICM Messages')).toHaveAttribute('aria-pressed', 'true');
  // The ICM chart links to the chains list.
  const chartLink = () =>
    browser.evaluate(() => {
      const body = document.querySelector('[aria-label="Chart Transactions"]')?.closest('[aria-busy]');
      const links = [...(body?.querySelectorAll('a[href$="/explorer/mainnet/chains"]') ?? [])];
      return links.filter((link) => !link.closest('[inert]')).length;
    });
  await expect.poll(chartLink).toBe(1);

  // 1W reads a shorter span (30d) than the opening window, so its data has to load.
  hold.on = true;
  await ranges.getByRole('radio', '1W').tap();
  await browser.keyboard.press('Tab');
  await browser.evaluate(() => {
    const body = document.querySelector('[aria-label="Chart Transactions"]')!.closest('[aria-busy]')!;
    const link = [...body.querySelectorAll('a[href$="/explorer/mainnet/chains"]')].find(
      (a) => !a.closest('[inert]'),
    ) as (HTMLElement & { __e2eTag?: string }) | undefined;
    link!.__e2eTag = 'leaving copy';
    link!.focus();
    return null;
  });
  const loading = await focusState(browser);
  expect(loading).toMatchObject({ focused: '/explorer/mainnet/chains', ring: true, busy: 'true' });

  // After the land the focus is on the link of the copy that arrived (not the tagged one), with its ring.
  await expect.poll(async () => (await focusState(browser)).busy, { timeout: 20_000 }).toBe('false');
  hold.on = false;
  await expect
    .poll(() => focusState(browser))
    .toMatchObject({ focused: '/explorer/mainnet/chains', ring: true, inert: false, tag: null });
});
