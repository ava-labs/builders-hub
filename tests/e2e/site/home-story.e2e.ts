import { test } from '@e2e-dev/web';
import type { Browser } from '@e2e-dev/web';
import { expect } from 'e2e';
import { isPhoneLayout } from '../lib/skip';
import { waitForHydration } from '../lib/hydration';
import { NAVIGATION_TIMEOUT, TWO_ROUTE_TIMEOUT } from './helpers';

// Below the hero and the stats board, the home page tells its story in five chapters
// (components/landing-v2/story). Each one makes one claim with one proof and ends in a door.
// The two drawings are WebGL on wide screens and stills on phones; either way the box has a name.
const CHAPTERS = [
  { id: 'own', title: /Own the chain\./ },
  { id: 'final', title: /Final in a second or less\./ },
  { id: 'interop', title: /Any L1 can connect\./ },
  { id: 'institutions', title: /Already in production\./ },
  { id: 'build', title: /Build yours\./i },
];

// Scrolls the chapter to the middle of the screen in steps, so its rise-in plays as a reader sees it.
async function bringIntoView(browser: Browser, id: string): Promise<void> {
  await browser.evaluate(async (chapter) => {
    const el = document.querySelector(`[data-chapter="${chapter}"]`);
    if (!el) return null;
    const target = el.getBoundingClientRect().top + window.scrollY - window.innerHeight / 3;
    const from = window.scrollY;
    for (let k = 1; k <= 8; k++) {
      window.scrollTo(0, from + ((target - from) * k) / 8);
      await new Promise((r) => setTimeout(r, 40));
    }
    return null;
  }, id);
}

test('home story chapters each show their title once scrolled into view', async ({ app, browser }) => {
  await app.open('/');
  await waitForHydration(browser, '[data-chapter="hero"] h1');
  for (const chapter of CHAPTERS) {
    await bringIntoView(browser, chapter.id);
    const section = browser.locator(`[data-chapter="${chapter.id}"]`);
    await expect(section.getByRole('heading', chapter.title, { level: 2 })).toBeVisible();
  }
});

test('home story drawings have a text alternative and fit the screen', async ({ app, browser }) => {
  await app.open('/');
  await waitForHydration(browser, '[data-chapter="hero"] h1');
  for (const id of ['own', 'interop']) {
    await bringIntoView(browser, id);
    const box = await browser.evaluate((chapter) => {
      const el = document.querySelector<HTMLElement>(`[data-chapter="${chapter}"] [role="img"]`);
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { label: el.getAttribute('aria-label') ?? '', left: r.left, right: r.right, width: innerWidth, height: r.height };
    }, id);
    expect(box).not.toBeNull();
    expect(box!.label.length).toBeGreaterThan(40);
    expect(box!.height).toBeGreaterThan(150);
    expect(box!.left).toBeGreaterThanOrEqual(-1);
    expect(box!.right).toBeLessThanOrEqual(box!.width + 1);
  }
});

test('home story finality ruler puts an L1 and the C-Chain on one line', async ({ app, browser }) => {
  await app.open('/');
  await waitForHydration(browser, '[data-chapter="hero"] h1');
  await bringIntoView(browser, 'final');
  const ruler = browser.locator('[data-chapter="final"]').getByRole('figure', /Time to finality/);
  await expect(ruler.getByText('Your L1')).toBeVisible();
  await expect(ruler.getByText('C-Chain')).toBeVisible();
  // one track, and the L1 is final before the C-Chain: its mark stands to the left
  const marks = await browser.evaluate(() => {
    const fig = document.querySelector('[data-chapter="final"] [role="figure"]');
    if (!fig) return null;
    const x = (name: string) => {
      const label = [...fig.querySelectorAll('span')].find((n) => n.textContent?.trim() === name);
      const r = label?.getBoundingClientRect();
      return r ? r.left + r.width / 2 : null;
    };
    return { tracks: fig.querySelectorAll('.h-px.w-full').length, l1: x('Your L1'), c: x('C-Chain') };
  });
  expect(marks).not.toBeNull();
  expect(marks!.tracks).toBe(1);
  expect(marks!.l1).not.toBeNull();
  expect(marks!.c).not.toBeNull();
  expect(marks!.l1!).toBeLessThan(marks!.c!);
});

test('home story doors link where they claim', async ({ app, browser }) => {
  await app.open('/');
  await waitForHydration(browser, '[data-chapter="hero"] h1');
  const own = browser.locator('[data-chapter="own"]');
  await expect(own.getByRole('link', 'Build an L1')).toHaveAttribute('href', '/console/create-l1');
  await expect(own.getByRole('link', /Run it in production/i)).toHaveAttribute('href', '/docs/tooling/avalanche-deploy/deploy-l1');
  const interop = browser.locator('[data-chapter="interop"]');
  await expect(interop.getByRole('link', 'Set up ICM')).toHaveAttribute('href', '/console/icm/setup');
  const build = browser.locator('[data-chapter="build"]');
  await expect(build.getByRole('link', 'Build an L1')).toHaveAttribute('href', '/console/create-l1');
  await expect(build.getByRole('link', 'Build on C-Chain')).toHaveAttribute('href', '/docs/primary-network#c-chain-contract-chain');
  const institutions = browser.locator('[data-chapter="institutions"]');
  await expect(institutions.getByRole('link', /BlackRock BUIDL/)).toHaveAttribute('href', '/integrations/blackrock');
});

// Each layer of the Own drawing, and the P-Chain plate under it, opens its docs.
const LAYER_DOCS = [
  { label: 'Virtual machine', href: '/docs/primary-network/virtual-machines#custom-vms-on-avalanche' },
  { label: 'Gas token', href: '/docs/avalanche-l1s/evm-configuration/customize-avalanche-l1#setting-the-genesis-allocation' },
  { label: 'Access', href: '/docs/avalanche-l1s/evm-configuration/customize-avalanche-l1#restricting-smart-contract-deployers' },
  { label: 'Validator set', href: '/docs/avalanche-l1s#we-need-custom-validator-management' },
];

test('home story layers read as text on a phone', async ({ app, browser }) => {
  await app.open('/');
  await waitForHydration(browser, '[data-chapter="hero"] h1');
  await bringIntoView(browser, 'own');
  // phones read the layers as a list of links, top layer first; wider screens label them in the drawing
  const phone = await isPhoneLayout(browser);
  if (phone) {
    await expect(browser.locator('[data-chapter="own"] ol')).toBeVisible();
    const layers = await browser.evaluate(() =>
      [...document.querySelectorAll('[data-chapter="own"] ol li a')].map((a) => a.textContent?.trim() ?? ''),
    );
    expect(layers.map((text) => LAYER_DOCS.find((l) => text.startsWith(l.label))?.label)).toEqual(
      LAYER_DOCS.map((l) => l.label),
    );
  }
  // nothing in the story is wider than the screen
  const overflow = await browser.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(1);
});

test('home story layers and the P-Chain open their docs', { timeout: TWO_ROUTE_TIMEOUT }, async ({ app, browser }) => {
  await app.open('/');
  await waitForHydration(browser, '[data-chapter="hero"] h1');
  await bringIntoView(browser, 'own');
  // a phone has the list under the drawing; a wider screen has the links on the drawing's labels. Either way one link per layer
  const own = browser.locator('[data-chapter="own"]');
  for (const layer of LAYER_DOCS) {
    await expect(own.getByRole('link', new RegExp(`^${layer.label}`))).toHaveAttribute('href', layer.href);
  }
  await expect(own.getByRole('link', 'P-Chain docs')).toHaveAttribute('href', '/docs/primary-network/platformvm-architecture');
  // the keyboard reaches a layer's docs too: over the canvas the scene takes the pointer, and these links keep the focus
  await own.getByRole('link', /^Gas token/).press('Enter');
  await expect(browser).toHaveURL(LAYER_DOCS[1].href, { timeout: NAVIGATION_TIMEOUT });
});
