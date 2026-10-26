import { test } from '@e2e-dev/web';
import type { Browser } from '@e2e-dev/web';
import { expect } from 'e2e';

// home-hero-first-paint and sol-hero-first-paint (app/global.css .hero-enter): the hero copy enters with a CSS
// animation from the first paint, so the server HTML shows it without waiting for the scripts. A hero that framer
// starts at opacity 0, or masked below its line, stays hidden until React hydrates.
//
// The engine cannot turn JavaScript off, so the test aborts every Next bundle: React never loads and never hydrates,
// and the page is what the server sent. Inline scripts still run (the theme script, for one).

const NEXT_BUNDLES = /\/_next\/static\/.+\.js(\?|$)/;

/**
 * The h1's text, one entry per text node that is not hidden for layout (the home hero keeps an invisible copy of its
 * word to size the line), with whether it shows: every ancestor opaque, on screen, and not clipped away (the element
 * at the text's centre is its own element, so no mask or overflow hides it). Also whether React hydrated the h1.
 */
function readHeading(browser: Browser) {
  return browser.evaluate(() => {
    const h1 = document.querySelector('h1');
    if (!h1) return null;
    const opacity = (node: Element) => {
      let value = 1;
      for (let at: Element | null = node; at; at = at.parentElement) value *= Number(getComputedStyle(at).opacity);
      return value;
    };
    const parts: { text: string; shown: boolean }[] = [];
    const walker = document.createTreeWalker(h1, NodeFilter.SHOW_TEXT);
    for (let text = walker.nextNode(); text; text = walker.nextNode()) {
      const owner = text.parentElement;
      const value = text.textContent?.trim() ?? '';
      if (!owner || !value || getComputedStyle(owner).visibility !== 'visible') continue;
      const range = document.createRange();
      range.selectNodeContents(text);
      const box = range.getBoundingClientRect();
      const hit = document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2);
      const onScreen = box.width > 0 && box.bottom > 0 && box.top < innerHeight;
      const unclipped = hit !== null && (hit === owner || owner.contains(hit));
      parts.push({ text: value, shown: opacity(owner) >= 0.99 && onScreen && unclipped });
    }
    return { hydrated: Object.keys(h1).some((key) => key.startsWith('__reactFiber$')), parts };
  });
}

/** Waits for the entrance to end (about 2.5s at most), then every part of the heading must show. */
async function expectHeadingShown(browser: Browser, words: readonly string[]) {
  await expect
    .poll(async () => {
      const heading = await readHeading(browser);
      return heading?.parts.filter((part) => !part.shown).map((part) => part.text) ?? ['(no h1)'];
    })
    .toEqual([]);
  const heading = await readHeading(browser);
  expect(heading?.parts.map((part) => part.text)).toEqual(expect.arrayContaining([...words]));
  expect(heading?.hydrated, 'React hydrated: the bundles were not blocked').toBe(false);
}

test('home hero heading shows with the scripts blocked', async ({ app, screen, browser }) => {
  await browser.route(NEXT_BUNDLES, (route) => route.abort());
  await app.open('/');
  // The last word of the heading changes every few seconds once React runs. Match the shape of the sentence.
  await expect(screen.getByRole('heading', /^Build an? [a-z]+ ?\.$/, { level: 1 })).toBeVisible();
  await expectHeadingShown(browser, ['Build', '.']);
});

test('Solutions hero words show with the scripts blocked', async ({ app, screen, browser }) => {
  await browser.route(NEXT_BUNDLES, (route) => route.abort());
  await app.open('/solutions');
  await expect(
    screen.getByRole('heading', 'Interoperability. Performance. Privacy. Compliance.', { level: 1 }),
  ).toBeVisible();
  await expectHeadingShown(browser, ['Interoperability', 'Performance', 'Privacy', 'Compliance']);
});
