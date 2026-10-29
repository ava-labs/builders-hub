import { test, type Browser, type WebRoute } from '@e2e-dev/web';
import { expect, type App } from 'e2e';
import { answerFirstVisitPrompts } from '../lib/visitor';
import { DATA, MULTI_PAGE } from './explorer-page';

// Rule: an answer valued in USD shows the AVAX price it was valued at. The page draws the server's price tile (the
// latest price, and the range over the rows) and its price line on the chart's right axis, says where the price comes
// from, and shows a fee of a fraction of a cent to three significant digits, not rounded to $0.03.
//
// The route answers from a fixture (one NDJSON answer line) with the layout lib/explorer-query/avax-usd.ts showPrice
// makes, so no model or database runs; api/explorer-query-usd.e2e.ts checks live answers against the feed.

const PATH = '/explorer/mainnet/c-chain/query';
const QUESTION = 'How many transactions are needed to burn $1 worth of AVAX in gas?';
const TITLE = 'Transactions needed to burn $1 of AVAX';
const PANEL = 'Transactions per dollar';
const FEED = "AVAX is valued in USD at the hourly mean of Chainlink's AVAX/USD price feed on the C-Chain (0x0A77230d17318075983913bC2145DB16C7366156), read from its own on-chain updates. The feed starts on July 14, 2021, so earlier hours have no USD value.";

// Oct 16 to 22, 2026, as the feed and raw_txs gave them (read 2026-10-23)
const ROWS = [
  ['2026-10-16', 283192, 1307.16, 13242.36, 10.1004],
  ['2026-10-17', 219789, 790.82, 7793.67, 9.8552],
  ['2026-10-18', 225650, 861.83, 8297.57, 9.6279],
  ['2026-10-19', 249484, 742.45, 7179.19, 9.6696],
  ['2026-10-20', 301333, 964.31, 9279.57, 9.623],
  ['2026-10-21', 263003, 870.05, 8488.62, 9.7565],
  ['2026-10-22', 261156, 722.96, 6700.76, 9.254],
].map(([t, txs, avax, usd, price]) => ({ t, txs, fees_avax: avax, fees_usd: usd, txs_per_usd: Math.round((10 * Number(txs)) / Number(usd)) / 10, avg_fee_usd: Math.round((1e6 * Number(usd)) / Number(txs)) / 1e6, avax_price_usd: price }));

const series = (column: string, label: string, format: string, axis = 'left', mark = 'auto') => ({ column, label, format, axis, mark, transform: 'none', dashed: false });

/** the route's answer line, as app/api/explorer/query streams it */
function answerLine(): string {
  const answer = {
    title: TITLE,
    note: 'Daily transactions divided by the fees they burned in USD, over the last 7 days.',
    sql: '$AVAXUSD(toStartOfDay(now()) - INTERVAL 7 DAY) SELECT 1',
    anchor: null,
    coverage: null,
    drill: null,
    names: {},
    chart: { kind: 'line', x: 't', series: [{ column: 'txs_per_usd', label: 'Transactions per $1' }, { column: 'avax_price_usd', label: 'AVAX price' }] },
    result: {
      columns: ['t', 'txs', 'fees_avax', 'fees_usd', 'txs_per_usd', 'avg_fee_usd', 'avax_price_usd'].map((name) => ({ name, type: name === 't' ? 'Date' : 'Float64' })),
      rows: ROWS,
      rowCount: ROWS.length,
      elapsedMs: 1,
      rowsRead: ROWS.length,
      bytesRead: 0,
      truncated: false,
      ranAt: new Date().toISOString(),
    },
    sources: [{ table: 'avax_usd', label: '', at: Date.now(), total: 0, known: 0, text: FEED }],
    // the designer's layout after showPrice: the price tile in place of a fourth, and the price line on the right axis
    visual: {
      stats: [
        { label: 'Transactions', column: 'txs', agg: 'sum', format: 'compact' },
        { label: 'Fees burned in USD', column: 'fees_usd', agg: 'sum', format: 'usd' },
        { label: 'Average fee', column: 'avg_fee_usd', agg: 'last', format: 'usd', sub: 'on Oct 22' },
        { label: 'AVAX price', column: 'avax_price_usd', agg: 'last', format: 'usd', sub: '$9.25 to $10.10 in these rows' },
      ],
      callouts: [],
      panels: [
        {
          title: PANEL,
          kind: 'line',
          x: 't',
          series: [series('txs_per_usd', 'Txs per $1', 'number'), series('avax_price_usd', 'AVAX price', 'usd', 'right', 'line')],
          markers: [],
          bands: [],
          referenceLines: [],
          stacked: false,
          sortDir: 'desc',
          width: 'full',
        },
      ],
    },
  };
  return `${JSON.stringify({ type: 'answer', answer })}\n`;
}

/** answers the question from the fixture; every other call to the route (a layout, a reading) gets a 400, so the page
    keeps the fixture's layout, and each prompt call is counted */
async function answerFromFixture(browser: Browser): Promise<{ prompts: string[] }> {
  const seen = { prompts: [] as string[] };
  await browser.route(/\/api\/explorer\/query$/, async (route: WebRoute) => {
    const body = JSON.parse(route.request.postData ?? '{}') as { prompt?: string };
    if (body.prompt) {
      seen.prompts.push(body.prompt);
      await route.fulfill({ headers: { 'content-type': 'application/x-ndjson; charset=utf-8' }, body: answerLine() });
      return;
    }
    await route.fulfill({ status: 400, json: { error: 'no fixture for this call' } });
  });
  return seen;
}

async function openAnswer(app: App, browser: Browser) {
  await app.open(PATH);
  await answerFirstVisitPrompts(browser);
  const seen = await answerFromFixture(browser);
  await app.open(`${PATH}?q=${encodeURIComponent(QUESTION)}`);
  return seen;
}

/** the words the panel's chart draws in its svg */
function chartWords(title: string): string[] {
  const panel = document.querySelector(`section[aria-label="${CSS.escape(title)}"]`);
  return panel ? [...panel.querySelectorAll('svg.recharts-surface text')].map((t) => t.textContent ?? '') : [];
}

test('an answer in USD shows the AVAX price it was valued at, and a fee of a fraction of a cent in full', MULTI_PAGE, async ({ app, screen, browser }) => {
  const seen = await openAnswer(app, browser);
  await expect(screen.getByRole('heading', TITLE)).toBeVisible(DATA);
  expect(seen.prompts).toEqual([QUESTION]);

  // the price tile: the latest row's price, and the range over the rows
  await expect(screen.getByText(/^AVAX price$/i).first()).toBeVisible();
  await expect(screen.getByText(/^\$9\.25$/)).toBeVisible();
  await expect(screen.getByText('$9.25 to $10.10 in these rows')).toBeVisible();
  // the average fee keeps its significant digits
  await expect(screen.getByText(/^\$0\.0257$/)).toBeVisible();
  // the chart draws the price on a right axis in dollars
  await expect.poll(async () => (await browser.evaluate(chartWords, PANEL)).filter((w) => /^\$\d+$/.test(w)).length, DATA).toBeGreaterThan(1);
  // the page says where the price comes from
  await expect(screen.getByText(FEED)).toBeVisible();
});
