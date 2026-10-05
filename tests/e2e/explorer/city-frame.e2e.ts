import { test, type Browser } from '@e2e-dev/web';
import { expect, type App, type Screen } from 'e2e';
import { desktopOnly, phoneOnly } from '../lib/skip';
import { answerFirstVisitPrompts } from '../lib/visitor';
import { DATA, MULTI_PAGE } from './explorer-page';

// The city view (components/explorer-v2/network/city-app.tsx) draws its controls as cards over the 3D city: the
// sidebar at the left, the search at the top, the live pane or a Query answer at the right, the figures strip at
// the bottom, and the news button in the bottom right corner. These tests measure the cards in the page.
// The terms in the checks:
// - sidebar: the open card at the left (the chain list, a district or a chain).
// - pane: the open card at the right (a chain's live view or a Query answer).
// - strip: the row of figures at the bottom (AVAX, ICM, Tx and others).
// - controls: the Chains button and the Explorer | City toggle.

const CITY = '/explorer/mainnet/chains';
const SIZES = [
  { width: 1440, height: 900 },
  { width: 1920, height: 1080 },
];
// The chip under the search that asks a fixed question: it opens a Query answer with no model call.
const QUERY_CHIP = /^Ask: .*burn/i;

type Box = { top: number; bottom: number; left: number; right: number };
type Frame = {
  width: number;
  strip: Box | null;
  news: boolean;
  sidebar: Box | null;
  pane: Box | null;
  controls: Box[];
};

// Measures the cards of the city. A card that is hidden, see-through or aria-hidden counts as closed. The browser
// runs this function, so it uses no helpers from this file.
async function measureFrame(): Promise<Frame> {
  const app = document.querySelector('[data-city-app]');
  if (!app) throw new Error('the city app is not in the page');
  const shown = (el: Element | null | undefined): el is HTMLElement =>
    !!el &&
    el.checkVisibility({ opacityProperty: true, visibilityProperty: true }) &&
    !el.closest('[aria-hidden="true"]') &&
    el.getBoundingClientRect().width > 0;
  const box = (el: Element): Box => {
    const r = el.getBoundingClientRect();
    return { top: r.top, bottom: r.bottom, left: r.left, right: r.right };
  };
  const width = app.getBoundingClientRect().width;
  const asides = [...app.querySelectorAll(':scope > aside')].filter(shown);
  const sidebar = asides.find((a) => a.getBoundingClientRect().left < width / 2);
  const pane = asides.find((a) => a.getBoundingClientRect().left >= width / 2);
  // The strip's Tx figure: its label, in the cell, in the strip.
  const label = [...app.querySelectorAll('span')].find((s) => /^Tx · /.test(s.textContent ?? ''));
  const strip = label?.parentElement?.parentElement;
  const news = app.querySelector('button[aria-label="News from Avalanche and the Builder Hub"]');
  const door = [...app.querySelectorAll('button[aria-expanded]')].find((b) => /Chains/.test(b.textContent ?? ''));
  const toggle = app.querySelector('[role="group"][aria-label="Explorer view"]');
  return {
    width,
    strip: shown(strip) ? box(strip) : null,
    news: shown(news),
    sidebar: sidebar ? box(sidebar) : null,
    pane: pane ? box(pane) : null,
    controls: [door, toggle].filter(shown).map(box),
  };
}

const frame = (browser: Browser) => browser.evaluate(measureFrame);

// How far the strip's centre is from the window's centre, in px. A hidden strip counts as 0 where `hiddenOk`.
async function stripOffset(browser: Browser, hiddenOk = false): Promise<number | 'hidden'> {
  const f = await frame(browser);
  if (!f.strip) return hiddenOk ? 0 : 'hidden';
  return Math.abs((f.strip.left + f.strip.right) / 2 - f.width / 2);
}

// The largest gap between the top edges and between the bottom edges of the sidebar and the pane, in px.
async function edgeGap(browser: Browser): Promise<number | string> {
  const f = await frame(browser);
  if (!f.sidebar || !f.pane) return `sidebar ${f.sidebar ? 'open' : 'shut'}, pane ${f.pane ? 'open' : 'shut'}`;
  return Math.max(Math.abs(f.sidebar.top - f.pane.top), Math.abs(f.sidebar.bottom - f.pane.bottom));
}

// The controls that stand outside the open sidebar, by more than 1 px.
async function controlsOutside(browser: Browser): Promise<number | string> {
  const f = await frame(browser);
  if (!f.sidebar) return 'sidebar shut';
  const s = f.sidebar;
  return f.controls.filter((c) => c.top < s.top - 1 || c.bottom > s.bottom + 1 || c.left < s.left - 1 || c.right > s.right + 1)
    .length;
}

const newsShown = async (browser: Browser) => (await frame(browser)).news;

// Opens the city again as a returning visitor: the privacy banner would stand in the bottom left corner.
async function reopenCity(app: App, screen: Screen, browser: Browser): Promise<void> {
  await answerFirstVisitPrompts(browser);
  await app.open(CITY);
  // The figures load after the page renders. The strip keeps its width while they come in.
  await expect(screen.getByRole('button', /^Chains/)).toBeVisible(DATA);
  await expect(screen.getByRole('group', 'Explorer view')).toBeVisible();
}

for (const size of SIZES) {
  test(`the city frame stays even at ${size.width}x${size.height}`, MULTI_PAGE, async ({ app, screen, browser }) => {
    await app.open(CITY);
    await desktopOnly(browser, 'the city frame is the desktop layout');
    await browser.setViewport(size);
    await reopenCity(app, screen, browser);

    // Shut: the strip is centred on the window and the news button stands in its corner.
    await expect.poll(() => stripOffset(browser)).toBeLessThanOrEqual(1);
    await expect.poll(() => newsShown(browser)).toBe(true);

    // The list: the controls are part of the sidebar, and the strip does not move.
    await screen.getByRole('button', /^Chains/).tap();
    await expect.poll(() => controlsOutside(browser)).toBe(0);
    await expect.poll(() => stripOffset(browser)).toBeLessThanOrEqual(1);

    // Fuji's list keeps the same frame.
    await screen.getByRole('tab', /^Fuji/).tap();
    await expect(screen.getByRole('tab', /^Fuji/)).toHaveAttribute('aria-selected', 'true');
    await expect.poll(() => controlsOutside(browser)).toBe(0);
    await screen.getByRole('tab', /^Mainnet/).tap();

    // A chain: its live pane opens at the right. The sidebar and the pane share their top and bottom edges, the
    // strip stays centred, and the news button steps aside.
    await screen.getByRole('button', /^C-Chain \d/).tap();
    await expect(screen.getByRole('button', 'Close the live view')).toBeVisible(DATA);
    await expect.poll(() => edgeGap(browser)).toBeLessThanOrEqual(1);
    await expect.poll(() => stripOffset(browser)).toBeLessThanOrEqual(1);
    await expect.poll(() => newsShown(browser)).toBe(false);
    await expect.poll(() => controlsOutside(browser)).toBe(0);

    // The pane shut: the news button comes back.
    await screen.getByRole('button', 'Close the live view').tap();
    await expect.poll(() => newsShown(browser)).toBe(true);
    await expect.poll(() => stripOffset(browser)).toBeLessThanOrEqual(1);

    // A Query answer beside the open sidebar: the same edges, and no news button. The strip stays centred or
    // steps aside where the answer leaves it no room.
    await screen.getByRole('button', QUERY_CHIP).first().tap();
    await expect(screen.getByRole('button', 'Close the answer')).toBeVisible(DATA);
    await expect.poll(() => edgeGap(browser)).toBeLessThanOrEqual(1);
    await expect.poll(() => newsShown(browser)).toBe(false);
    await expect.poll(() => stripOffset(browser, true)).toBeLessThanOrEqual(1);
    await screen.getByRole('button', 'Close the answer').tap();
    await expect.poll(() => newsShown(browser)).toBe(true);

    // A Query answer with the sidebar shut.
    await screen.getByRole('button', /^Chains/).tap();
    await expect.poll(async () => (await frame(browser)).sidebar).toBeNull();
    await screen.getByRole('button', QUERY_CHIP).first().tap();
    await expect(screen.getByRole('button', 'Close the answer')).toBeVisible(DATA);
    await expect.poll(() => newsShown(browser)).toBe(false);
    await expect.poll(() => stripOffset(browser, true)).toBeLessThanOrEqual(1);
    await screen.getByRole('button', 'Close the answer').tap();
    await expect.poll(() => newsShown(browser)).toBe(true);
    await expect.poll(() => stripOffset(browser)).toBeLessThanOrEqual(1);
  });
}

// Pairs of controls in the first screen of the phone layout that overlap by more than 1 px. A control inside
// another one is not a pair. The browser runs this function, so it uses no helpers from this file.
function phoneOverlaps(): string[] {
  const nav = document.getElementById('nd-nav')?.getBoundingClientRect().bottom ?? 0;
  const controls = [...document.querySelectorAll('a, button, input, select, [role="tab"]')].filter((el) => {
    const r = el.getBoundingClientRect();
    return (
      el.checkVisibility({ opacityProperty: true, visibilityProperty: true }) &&
      r.width > 0 &&
      r.height > 0 &&
      r.top >= nav &&
      r.top < window.innerHeight &&
      r.right > 0 &&
      r.left < window.innerWidth &&
      !el.closest('#nd-nav')
    );
  });
  const name = (el: Element) =>
    `${el.tagName.toLowerCase()} "${(el.getAttribute('aria-label') ?? el.textContent ?? '').trim().slice(0, 30)}"`;
  const problems: string[] = [];
  controls.forEach((a, i) => {
    controls.slice(i + 1).forEach((b) => {
      if (a.contains(b) || b.contains(a)) return;
      const ra = a.getBoundingClientRect();
      const rb = b.getBoundingClientRect();
      const x = Math.min(ra.right, rb.right) - Math.max(ra.left, rb.left);
      const y = Math.min(ra.bottom, rb.bottom) - Math.max(ra.top, rb.top);
      if (x > 1 && y > 1) problems.push(`${name(a)} overlaps ${name(b)}`);
    });
  });
  if (document.documentElement.scrollWidth > window.innerWidth + 1) {
    problems.push(`the page is ${document.documentElement.scrollWidth} px wide in a ${window.innerWidth} px window`);
  }
  return problems;
}

test('the city on a phone has no overlapping controls', MULTI_PAGE, async ({ app, screen, browser }) => {
  await app.open(CITY);
  await phoneOnly(browser, 'the phone layout of the city');
  await answerFirstVisitPrompts(browser);
  await app.open(CITY);
  await expect(screen.getByRole('tab', /^Mainnet/)).toBeVisible(DATA);
  await expect(screen.getByRole('button', 'News from Avalanche and the Builder Hub')).toBeHidden();
  await expect.poll(() => browser.evaluate(phoneOverlaps)).toEqual([]);
});
