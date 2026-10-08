import { test } from '@e2e-dev/web';
import { expect } from 'e2e';
import { phoneOnly } from '../lib/skip';
import { answerFirstVisitPrompts } from '../lib/visitor';
import { DATA, MULTI_PAGE } from './explorer-page';

// The city view (components/explorer-v2/network/city-app.tsx) on a phone: a list of the chains with the figures
// over it, and no 3D city. The desktop frame (the sidebar, the panes, the centred strip) is not tested here: the
// 3D city made those checks flaky on the CI runners.

const CITY = '/explorer/mainnet/chains';

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
  // The list's network tabs: this City is current, and the other network's City is a link. CSS sets their text in
  // upper case, and a text query reads the rendered text.
  const networks = screen.getByRole('group', 'Network');
  await expect(networks.getByText(/^Mainnet/i)).toHaveAttribute('aria-current', 'page', DATA);
  await expect(networks.getByRole('link', 'Fuji')).toHaveAttribute('href', '/explorer/fuji/chains');
  await expect(screen.getByRole('button', 'News from Avalanche and the Builder Hub')).toBeHidden();
  await expect.poll(() => browser.evaluate(phoneOverlaps)).toEqual([]);
});
