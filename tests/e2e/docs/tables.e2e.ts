import { test, type Browser } from '@e2e-dev/web';
import { expect, type App, type Screen } from 'e2e';

// fumadocs draws the frame of a docs table (border, radius, background) on the table element, and the header
// cells (th) draw the header fill. When a docs rule made the table a block, the frame kept the full column width,
// but the rows formed an inner table only as wide as their content: the right part of the frame was empty.
// tests/unit/docs/table-css.test.ts checks the CSS. These tests measure the tables in the page, at both sizes.

type TablePage = { path: string; title: string };

// One page for each kind of docs table. The terms in the checks:
// - frame: the border box of the table element.
// - holder: the div that fumadocs puts around each table. It scrolls a table that is wider than it.
// - column: the prose block of the page.
const PAGES: TablePage[] = [
  // Remote content (yarn build:remote). The "Current Recommended Version" table is narrower than the column.
  { path: '/docs/nodes/releases', title: 'AvalancheGo Releases' },
  // Narrow tables, with and without code. Most of them scroll on a phone.
  { path: '/docs/nodes/maintain/recommended-metrics', title: 'Key Metrics & Alerts' },
  // Many small tables, each with inline code.
  { path: '/docs/tooling/avalanche-sdk/client/utils', title: 'Utilities' },
  // Wide tables with code. Five of them scroll on a phone.
  { path: '/docs/nodes/run-a-node/common-errors', title: 'Common Errors' },
];

type TableReport = { tables: number; problems: string[] };

// Opens a docs page and waits until React has hydrated it, as openDocsPage in docs-page.ts does. The title check
// comes first: a remote page that yarn build:remote did not write is a 404, and the failure then names the page.
async function openTablePage(app: App, screen: Screen, browser: Browser, page: TablePage): Promise<void> {
  await app.open(page.path);
  await expect(screen.getByRole('heading', page.title, { level: 1 })).toBeVisible();
  await expect(browser.locator('body[data-layout="docs"]')).toBeAttached();
}

// Measures each visible table in the docs page and returns what is wrong with it. A width can be a fraction of a
// pixel, so each comparison allows 1 px. The browser runs this function, so it uses no helpers from this file.
async function measureTables(): Promise<TableReport> {
  await document.fonts.ready;
  const problems: string[] = [];
  const tables = [...document.querySelectorAll('#nd-page table')].filter(
    (table) => table.getBoundingClientRect().width > 0,
  ) as HTMLTableElement[];
  tables.forEach((table, index) => {
    const label = [...table.querySelectorAll('th, td')].map((cell) => cell.textContent?.trim()).find(Boolean);
    const name = `table ${index + 1} (${label ?? 'empty'})`;
    const frame = table.getBoundingClientRect();
    const style = getComputedStyle(table);
    const inner = frame.width - parseFloat(style.borderLeftWidth) - parseFloat(style.borderRightWidth);

    // The rows fill the frame, and they do not run past it unless the table itself scrolls.
    const rows = Math.max(...[...table.rows].map((row) => row.getBoundingClientRect().width));
    if (rows < inner - 1) problems.push(`${name}: the rows are ${rows} px wide in a ${inner} px frame`);
    if (rows > inner + 1 && !['auto', 'scroll'].includes(style.overflowX)) {
      problems.push(`${name}: the rows are ${rows} px wide and the ${inner} px frame cuts them off`);
    }

    // The header fill spans the frame.
    const head = table.tHead?.rows[0];
    if (head && head.cells.length > 0) {
      const cells = [...head.cells].map((cell) => cell.getBoundingClientRect());
      const fill = Math.max(...cells.map((cell) => cell.right)) - Math.min(...cells.map((cell) => cell.left));
      if (fill < inner - 1) problems.push(`${name}: the header fill is ${fill} px wide in a ${inner} px frame`);
      const color = getComputedStyle(head.cells[0]).backgroundColor;
      if (color === 'transparent' || color === 'rgba(0, 0, 0, 0)') problems.push(`${name}: the header has no fill`);
    }

    // The frame fills its holder.
    const holder = table.parentElement as HTMLElement;
    const holderStyle = getComputedStyle(holder);
    const room = holder.clientWidth - parseFloat(holderStyle.paddingLeft) - parseFloat(holderStyle.paddingRight);
    if (frame.width < room - 1) problems.push(`${name}: the frame is ${frame.width} px wide in a ${room} px holder`);

    // A table wider than the column scrolls inside a box that ends at the column edge. The page does not scroll.
    const column = (table.closest('.prose') ?? table.closest('article')) as HTMLElement;
    const edge = column.getBoundingClientRect().right;
    if (frame.right > edge + 1) {
      let scroller: HTMLElement | null = null;
      for (let node = table.parentElement; node && node !== column; node = node.parentElement) {
        if (['auto', 'scroll'].includes(getComputedStyle(node).overflowX)) {
          scroller = node;
          break;
        }
      }
      if (!scroller || scroller.getBoundingClientRect().right > edge + 1) {
        problems.push(`${name}: the table runs ${frame.right - edge} px past the column with no scroll box`);
      }
    }
  });
  const sideways = document.documentElement.scrollWidth - window.innerWidth;
  if (sideways > 1) problems.push(`the page scrolls sideways by ${sideways} px`);
  return { tables: tables.length, problems };
}

for (const page of PAGES) {
  test(`tables fill their frame on ${page.path}`, async ({ app, screen, browser }) => {
    await openTablePage(app, screen, browser, page);
    const report = await browser.evaluate(measureTables);
    expect(report.tables, `visible tables on ${page.path}`).toBeGreaterThan(0);
    expect(report.problems).toEqual([]);
  });
}

test('a table in a closed accordion fills its frame when the accordion opens', async ({ app, screen, browser }) => {
  await openTablePage(app, screen, browser, PAGES[0]);
  // Each release has a closed "Download Assets" accordion with a narrow table of files. Open the newest one.
  const downloads = screen.getByRole('button', 'Download Assets').first();
  const before = await browser.evaluate(measureTables);
  await downloads.tap();
  await expect(downloads).toBeExpanded();
  await expect
    .poll(async () => (await browser.evaluate(measureTables)).tables, { message: 'visible tables after the accordion opens' })
    .toBe(before.tables + 1);
  expect((await browser.evaluate(measureTables)).problems).toEqual([]);
});
