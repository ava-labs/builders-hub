import { test } from '@e2e-dev/web';
import { expect } from 'e2e';
import { openDocsPage } from './docs-page';

// app/docs/styles.css gives each block of a docs page overflow-x: auto, so a wide block scrolls. A heading is
// text that wraps, and as a scroll container it showed a scrollbar on hover in macOS, as on the Firewood title.
const PAGES = ['/docs/primary-network/firewood', '/docs/nodes/run-a-node/common-errors'];

for (const path of PAGES) {
  test(`docs headings are not scroll containers on ${path}`, async ({ app, browser }) => {
    await openDocsPage(app, browser, path);
    const report = await browser.evaluate(() => {
      const headings = [...document.querySelectorAll('article > :is(h1, h2, h3), .prose > :is(h1, h2, h3)')];
      const scrolling = headings
        .filter((heading) => {
          const style = getComputedStyle(heading);
          return style.overflowX !== 'visible' || style.overflowY !== 'visible';
        })
        .map((heading) => `${heading.tagName} "${heading.textContent?.trim()}"`);
      return { headings: headings.length, scrolling };
    });
    expect(report.headings, `headings on ${path}`).toBeGreaterThan(0);
    expect(report.scrolling).toEqual([]);
  });
}
