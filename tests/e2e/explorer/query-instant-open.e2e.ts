import { test, type Browser, type WebRoute } from '@e2e-dev/web';
import { expect, type Screen } from 'e2e';
import { DATA, MULTI_PAGE, NAVIGATION, OVERVIEW_BLOCK_ROW, pathPattern } from './explorer-page';

// Rule: Enter on a question in an explorer search box opens the Query page at once. The question shows on the thread
// line over the loader on the frame Enter lands, before the server has sent the Query page; the answer fills in when
// it is ready. The box's shell draws the Query page's first frame (components/explorer-v2/evm/query-asking.tsx), and
// the Query page draws the same frame from ?q.
//
// Before the fix (measured on production, 2026-10-07): the old page stayed on screen until the Query route came back
// (160 ms warm, up to 4 s when its database read was cold), then faded in for 214 ms, and the question showed only
// with the answer.
//
// The route answers from a fixture after ANSWER_MS, so no model or database runs, and the working frame has time to
// be seen. The Query page itself is held back SERVER_MS on its way from the server, so the frame inside the budget can
// only be the one the box's shell draws, on the old page's URL. On the old page the question first shows with the
// answer, so the budget below fails there.

const QUESTION = 'How many transactions were there per hour today';
const TITLE = 'Transactions per hour';
const ANSWER_MS = 1500;
const SERVER_MS = 1500;

// The frame shows on the next animation frame after Enter: 7 to 8 ms on a local production build at the desktop size,
// 26 to 51 ms on a phone at 4x CPU (n=5 per box, 2026-10-07). The budget leaves room for a loaded CI runner and sits
// far below SERVER_MS, so the Query page's own frame cannot pass it.
const BUDGET_MS = 500;

// The boxes and the Query page each opens. Each start page loads its block rows in the browser, so a row shows that
// React has hydrated the page and the box is live.
const BOXES = [
  { name: 'the C-Chain box', from: '/explorer/mainnet/c-chain', box: 'Search the chain or ask a question about it', to: '/explorer/mainnet/c-chain/query' },
  { name: 'the All Networks box', from: '/explorer/mainnet', box: 'Search or ask a question', to: '/explorer/mainnet/query' },
  { name: 'the P-Chain box', from: '/explorer/mainnet/p-chain', box: 'Search or ask a question', to: '/explorer/mainnet/p-chain/query' },
];

/** the route's answer line: a bar chart of 13 hours */
function answerLine(): string {
  const hour = 3_600_000;
  const last = Math.floor(Date.now() / hour) * hour;
  const rows = Array.from({ length: 13 }, (_, i) => ({ t: new Date(last - (12 - i) * hour).toISOString().slice(0, 19).replace('T', ' '), txs: 80_000 + ((i * 7919) % 20_000) }));
  const answer = {
    title: TITLE,
    note: 'A fixture answer.',
    sql: 'SELECT toStartOfHour(block_time) AS t, count() AS txs FROM raw_txs WHERE block_time >= today() GROUP BY t ORDER BY t',
    anchor: null,
    coverage: null,
    drill: null,
    names: {},
    chart: { kind: 'bar', x: 't', series: [{ column: 'txs', label: 'Transactions' }] },
    result: { columns: [{ name: 't', type: 'String' }, { name: 'txs', type: 'Float64' }], rows, rowCount: rows.length, elapsedMs: 1, rowsRead: rows.length, bytesRead: 0, truncated: false, ranAt: new Date().toISOString() },
    visual: {
      stats: [],
      callouts: [],
      panels: [{ title: TITLE, kind: 'bar', x: 't', series: [{ column: 'txs', label: 'Transactions', format: 'number', axis: 'left', mark: 'auto', transform: 'none', dashed: false }], markers: [], bands: [], referenceLines: [], stacked: false, sortDir: 'desc', width: 'full' }],
    },
  };
  return `${JSON.stringify({ type: 'answer', answer })}\n`;
}

/** holds the Query page's own requests (its RSC, and the warm a focused box sends) SERVER_MS before they go on */
async function holdQueryPage(browser: Browser, path: string): Promise<void> {
  const escaped = path.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  await browser.route(new RegExp(`^https?://[^/]+${escaped}(\\?|$)`), async (route: WebRoute) => {
    await new Promise((resolve) => setTimeout(resolve, SERVER_MS));
    await route.continue();
  });
}

/** answers the question from the fixture after ANSWER_MS; any other call to the route fails, and the test says which */
async function answerLate(browser: Browser): Promise<string[]> {
  const unexpected: string[] = [];
  await browser.route(/\/api\/explorer\/query$/, async (route: WebRoute) => {
    const body = JSON.parse(route.request.postData ?? '{}') as { prompt?: string };
    if (body.prompt === QUESTION) {
      await new Promise((resolve) => setTimeout(resolve, ANSWER_MS));
      await route.fulfill({ headers: { 'content-type': 'application/x-ndjson; charset=utf-8' }, body: answerLine() });
      return;
    }
    unexpected.push((route.request.postData ?? '').slice(0, 120));
    await route.fulfill({ status: 400, json: { error: 'no fixture for this call' } });
  });
  return unexpected;
}

type Seen = { enter: number | null; said: number | null; working: number | null; at: string | null };

// Records, as performance.now(), the Enter keydown, the first animation frame where a section shows a crumb that reads
// the question (said), and the first where that section also holds the loader (working), with the path then (at). The
// document stays through the client-side navigation, so the recorder sees the old page, the frame its shell draws, and
// the Query page. The browser runs this function, so it uses no helpers.
function record(question: string): null {
  const seen: Seen = { enter: null, said: null, working: null, at: null };
  (window as unknown as { asked: Seen }).asked = seen;
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && seen.enter === null) seen.enter = performance.now();
  }, { capture: true });
  const look = () => {
    if (seen.enter !== null) {
      const now = performance.now();
      const said = [...document.querySelectorAll('section')].filter((s) => [...s.querySelectorAll('span')].some((c) => c.textContent === question && (c as HTMLElement).offsetParent !== null));
      if (said.length && seen.said === null) seen.said = now;
      if (said.some((s) => s.querySelector('[role="status"]'))) {
        seen.working = now;
        seen.at = location.pathname;
      }
    }
    if (seen.working === null) requestAnimationFrame(look);
  };
  requestAnimationFrame(look);
  return null;
}

/** ms from Enter to each mark, and the path at the working mark, once the question has shown */
async function marks(browser: Browser): Promise<{ said: number; working: number | null; at: string | null } | null> {
  return browser.evaluate(() => {
    const { enter, said, working, at } = (window as unknown as { asked: Seen }).asked;
    if (enter === null || said === null) return null;
    return { said: Math.round(said - enter), working: working === null ? null : Math.round(working - enter), at };
  });
}

async function hydrated(screen: Screen): Promise<void> {
  await expect(screen.getByRole('link', OVERVIEW_BLOCK_ROW).first()).toBeVisible(DATA);
}

for (const b of BOXES) {
  test(`a question asked in ${b.name} opens the Query page at once`, MULTI_PAGE, async ({ app, screen, browser }) => {
    const unexpected = await answerLate(browser);
    await holdQueryPage(browser, b.to);
    await app.open(b.from);
    await hydrated(screen);
    const box = screen.getByRole('textbox', b.box);
    await box.fill(QUESTION);
    await browser.evaluate(record, QUESTION);
    await box.press('Enter');

    // the working frame: the question over the loader, on the frame Enter lands
    await expect.poll(() => marks(browser), DATA).not.toBeNull();
    const m = await marks(browser);
    expect(m?.working, `the question first showed ${m?.said} ms after Enter, with no loader under it: the page showed it only with the answer`).not.toBeNull();
    expect(m!.working!, `the question showed over the loader ${m?.working} ms after Enter, against a budget of ${BUDGET_MS} ms`).toBeLessThan(BUDGET_MS);
    // drawn by the box's shell: the Query page was still on its way, so the URL was the old page's
    expect(m?.at, 'the working frame showed only once the Query page had come').toBe(new URL(b.from, 'https://x').pathname);

    // the Query page, on the thread's URL, then the answer
    await expect(browser).toHaveURL(pathPattern(b.to), NAVIGATION);
    expect(new URL(await browser.evaluate(() => location.href)).searchParams.get('q')).toBe(QUESTION);
    await expect(screen.getByRole('heading', TITLE)).toBeVisible(DATA);

    // Back returns to the page the question was asked on
    await browser.back();
    await expect(browser).toHaveURL(pathPattern(b.from), NAVIGATION);
    expect(unexpected).toEqual([]);
  });
}
