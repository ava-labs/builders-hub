import { test, type Browser } from '@e2e-dev/web';
import { expect } from 'e2e';
import { isPhoneLayout } from '../lib/skip';
import { answerFirstVisitPrompts } from '../lib/visitor';
import { DATA, MULTI_PAGE, VALIDATOR_ROW } from './explorer-page';

// The explorer draws its charts and figures in 3D blocks: a front face that holds the content, and a lit top face
// and a shaded right face that are the frame (ReadoutBlock in components/explorer-v2/evm/EvmOverviewStats.tsx).
// A chart or a figure must stay on the front face. On 2026-10-05 a phone showed the "Blocks proposed" chart of a
// node page running onto the right face, because the right face repeated the last bar. The C-Chain "Chain Height"
// and "State Root" figures also ran under the right edge at 360 px.

// The narrow phone size. The phone target is 390 px wide (PHONE_VIEWPORT in e2e.config.ts).
const NARROW_PHONE = { width: 360, height: 780 };

// Each page that draws charts in blocks, and the label of one of its chart blocks. The charts load from the data API
// after the page renders, so the test measures the page when that block has drawn its chart and the blocks have
// stopped changing.
const PAGES = [
  { path: '/explorer/mainnet', block: 'Transactions' },
  { path: '/explorer/mainnet/token', block: 'C-Chain Fees Burned' },
  { path: '/explorer/mainnet/p-chain', block: 'Stake Expiring' },
  { path: '/explorer/mainnet/p-chain/staking', block: 'Total Staked' },
  { path: '/explorer/mainnet/c-chain', block: 'Network Activity' },
  { path: '/explorer/mainnet/c-chain/blocks', block: 'State Root' },
  { path: '/explorer/mainnet/c-chain/accounts', block: 'Active Addresses' },
  { path: '/explorer/mainnet/c-chain/txs/icm', block: 'Messages' },
  { path: '/explorer/mainnet/c-chain/gas', block: 'Block Fullness' },
  { path: '/explorer/mainnet/c-chain/gas/base-fee', block: 'Spike Premium' },
  { path: '/explorer/mainnet/c-chain/gas/utilization', block: 'Block by Block' },
  { path: '/explorer/mainnet/c-chain/gas/fee-seasonality', block: 'Hour of Day' },
  { path: '/explorer/mainnet/c-chain/defi', block: 'DEX Volume' },
  { path: '/explorer/mainnet/c-chain/defi/stablecoins', block: 'Market Cap' },
];

// The time the blocks of a page must stay the same before the test reads them: charts that load after the named
// block are then measured too.
const SETTLE_MS = 3000;

// Returns null until the block whose label starts with `label` has drawn its chart and the blocks (their count, the
// count that hold a chart, and the window width) have not changed for `settleMs`. Then returns the problems of the
// page: a mark on the frame of a block that holds a chart, content past the front face of a block, and a page wider
// than the window. Content that an element inside the front face clips on purpose (an ellipsis) is not a problem.
// The browser runs this function, so it uses no helpers from this file.
function blockProblems([label, settleMs]: [string, number]): string[] | null {
  // A right face is skewed by -45 degrees on y: transform matrix(1, -1, 0, 1, x, y).
  const isRightFace = (el: Element) => {
    const m = /^matrix\(([^)]+)\)$/.exec(getComputedStyle(el).transform);
    const [a, b, c, d] = (m?.[1] ?? '').split(',').map(Number);
    return a === 1 && b === -1 && c === 0 && d === 1;
  };
  const drawn = (el: Element) => {
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  };
  const isChart = (el: Element) => {
    const r = el.getBoundingClientRect();
    return r.width >= 40 && r.height >= 16;
  };
  const blocks = [...document.querySelectorAll('[aria-hidden="true"]')].filter(isRightFace).flatMap((right) => {
    const block = right.parentElement;
    const face = block && [...block.children].find((c) => c.getAttribute('aria-hidden') !== 'true');
    if (!block || !face) return [];
    const frames = [...block.children].filter((c) => c !== face);
    const name = ((face as HTMLElement).innerText ?? '').trim().split('\n')[0].slice(0, 40);
    return [{ face, frames, name, charts: [...face.querySelectorAll('svg, canvas')].filter(isChart) }];
  });
  const ready = blocks.some((b) => b.name.toLowerCase().startsWith(label.toLowerCase()) && b.charts.length > 0);
  if (!ready) return null;
  // The last state the blocks were in, kept on the window between reads.
  const shape = `${blocks.length} ${blocks.filter((b) => b.charts.length).length} ${window.innerWidth}`;
  const seen = window as unknown as { chartFramesShape?: { shape: string; since: number } };
  if (seen.chartFramesShape?.shape !== shape) seen.chartFramesShape = { shape, since: performance.now() };
  if (performance.now() - seen.chartFramesShape.since < settleMs) return null;

  const problems: string[] = [];
  for (const { face, frames, name, charts } of blocks) {
    // The frame of a chart block carries no marks: a mark there reads as the chart running past the frame.
    const marks = frames.flatMap((f) => [...f.querySelectorAll('*')]).filter(drawn).length;
    if (charts.length && marks) problems.push(`"${name}": the frame draws ${marks} marks`);
    // Everything on the front face stays inside it, unless an element between them clips it.
    const box = face.getBoundingClientRect();
    for (const el of face.querySelectorAll('*')) {
      if (!drawn(el)) continue;
      let clipped = false;
      for (let a = el.parentElement; a && a !== face; a = a.parentElement) {
        if (getComputedStyle(a).overflowX !== 'visible') clipped = true;
      }
      if (clipped) continue;
      const r = el.getBoundingClientRect();
      const past = Math.max(box.left - r.left, r.right - box.right, box.top - r.top, r.bottom - box.bottom);
      if (past > 1) {
        const what = (el.textContent ?? '').trim().slice(0, 24) || el.tagName.toLowerCase();
        problems.push(`"${name}": "${what}" runs ${Math.round(past)} px past the front face`);
      }
    }
  }
  if (document.documentElement.scrollWidth > window.innerWidth + 1) {
    problems.push(`the page is ${document.documentElement.scrollWidth} px wide in a ${window.innerWidth} px window`);
  }
  return [...new Set(problems)];
}

// Checks the open page at the target's size, and a phone also at the narrow phone size.
async function expectChartsInFrames(browser: Browser, block: string): Promise<void> {
  const read = () => browser.evaluate(blockProblems, [block, SETTLE_MS] as [string, number]);
  await expect.poll(read, DATA).toEqual([]);
  if (!(await isPhoneLayout(browser))) return;
  await browser.setViewport(NARROW_PHONE);
  await expect.poll(read, DATA).toEqual([]);
}

for (const { path, block } of PAGES) {
  test(`${path}: charts and figures stay inside their blocks`, MULTI_PAGE, async ({ app, browser }) => {
    await app.open(path);
    await answerFirstVisitPrompts(browser);
    await app.open(path);
    await expectChartsInFrames(browser, block);
  });
}

// The node page of the top validator by stake: its "Blocks proposed" chart is the one that ran past its frame.
test('node page: charts and figures stay inside their blocks', MULTI_PAGE, async ({ app, browser, screen }) => {
  await app.open('/explorer/mainnet/p-chain/validators');
  await answerFirstVisitPrompts(browser);
  // The roster sorts by total stake, largest first, and loads its rows from the data API.
  const top = screen.getByRole('link', VALIDATOR_ROW).first();
  await expect(top).toBeVisible(DATA);
  const href = (await top.getAttribute('href')) ?? '';
  expect(href).toMatch(/^\/explorer\/mainnet\/p-chain\/node\/NodeID-[1-9A-HJ-NP-Za-km-z]+$/);
  await app.open(href);
  await expectChartsInFrames(browser, 'Blocks Proposed');
});
