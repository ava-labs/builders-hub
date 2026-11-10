import { test, type Browser, type WebRoute } from '@e2e-dev/web';
import { expect, type Screen } from 'e2e';
import { DATA, MULTI_PAGE, NAVIGATION, pathPattern } from './explorer-page';

// Rule: the network Query page (/explorer/mainnet/query) asks the C-Chain and every L1 at once. Its picker offers
// All chains first. A question about every chain ("each chain", "per chain", "across all chains") goes to All chains,
// and so does a link with ?chain=all. A row of a network answer opens on the chain its chain_id names, and the answer
// has no Pin, since a board's SQL is bound to one chain.
//
// The route answers from a fixture, so no model or database runs. The test reads the chain each call asks.

const PATH = '/explorer/mainnet/query';
const QUESTION = 'Largest fee paid on each chain today';
const TITLE = 'Largest fee per chain today';
const CCHAIN_TX = `0x${'a1'.repeat(32)}`;
const BEAM_TX = `0x${'b2'.repeat(32)}`;

/** the route's answer line: one row per chain, each with its chain_id and its transaction */
function answerLine(): string {
  const rows = [
    { chain: 'C-Chain', chain_id: '43114', token: 'AVAX', tx_hash: CCHAIN_TX, fee_native: 1.25 },
    { chain: 'Beam', chain_id: '4337', token: 'BEAM', tx_hash: BEAM_TX, fee_native: 310.5 },
  ];
  const columns = [
    { name: 'chain', type: 'String' },
    { name: 'chain_id', type: 'UInt64' },
    { name: 'token', type: 'String' },
    { name: 'tx_hash', type: 'String' },
    { name: 'fee_native', type: 'Float64' },
  ];
  const answer = {
    title: TITLE,
    note: 'A fixture answer.',
    sql: "SELECT n.chain AS chain, t.chain_id AS chain_id, n.token AS token, argMax(t.hash, t.fee) AS tx_hash, max(t.fee) AS fee_native FROM raw_txs AS t INNER JOIN chain_names AS n ON n.chain_id = t.chain_id WHERE t.block_time >= today() GROUP BY chain, chain_id, token",
    anchor: null,
    coverage: null,
    drill: null,
    names: {},
    chart: { kind: 'table', series: [] },
    result: { columns, rows, rowCount: rows.length, elapsedMs: 1, rowsRead: rows.length, bytesRead: 0, truncated: false, ranAt: new Date().toISOString() },
    visual: {
      stats: [],
      callouts: [],
      panels: [{ title: TITLE, kind: 'table', series: [], markers: [], bands: [], referenceLines: [], stacked: false, sortDir: 'desc', width: 'full' }],
    },
  };
  return `${JSON.stringify({ type: 'answer', answer })}\n`;
}

/** answers every question from the fixture, and keeps the chain each call asked */
async function answerAll(browser: Browser): Promise<string[]> {
  const asked: string[] = [];
  await browser.route(/\/api\/explorer\/query$/, async (route: WebRoute) => {
    const body = JSON.parse(route.request.postData ?? '{}') as { chainId?: unknown; prompt?: string };
    asked.push(String(body.chainId));
    if (body.prompt) {
      await route.fulfill({ headers: { 'content-type': 'application/x-ndjson; charset=utf-8' }, body: answerLine() });
      return;
    }
    // a second stage (layout, reading) gets no fixture: the page keeps the layout it has
    await route.fulfill({ status: 400, json: { error: 'no fixture for this call' } });
  });
  return asked;
}

/** the picker's face: the chain that answers a question naming none */
function picker(screen: Screen, chain: string) {
  return screen.getByRole('button', new RegExp(`^Answering from ${chain}\\b`));
}

/** the hrefs of the answer's transaction links */
async function txLinks(browser: Browser): Promise<string[]> {
  return browser.evaluate(() => [...document.querySelectorAll('a[href*="/tx/0x"]')].map((a) => a.getAttribute('href') ?? ''));
}

test('a question about every chain is asked of All chains, and its rows open on their own chains', MULTI_PAGE, async ({ app, screen, browser }) => {
  const asked = await answerAll(browser);
  await app.open(`${PATH}?q=${encodeURIComponent(QUESTION)}`);

  await expect(screen.getByRole('heading', TITLE)).toBeVisible(DATA);
  await expect(picker(screen, 'All chains')).toBeVisible();
  expect(asked[0]).toBe('all');

  // each transaction opens on its own chain's explorer, never on a page no chain has
  await expect.poll(() => txLinks(browser), DATA).toEqual([`/explorer/mainnet/c-chain/tx/${CCHAIN_TX}`, `/explorer/mainnet/beam/tx/${BEAM_TX}`]);
  await expect(screen.getByRole('button', 'Pin this answer to a board')).toHaveCount(0);

  // the picker offers All chains first, and the C-Chain after it
  await picker(screen, 'All chains').click();
  const items = screen.getByRole('menu');
  await expect(items.getByRole('menuitem').first()).toHaveText(/^All chains/);
  await expect(items.getByRole('menuitem', /^C-Chain/)).toBeVisible();
});

test('a link with ?chain=all asks All chains, whatever its question names', MULTI_PAGE, async ({ app, screen, browser }) => {
  const asked = await answerAll(browser);
  // no word here is about every chain: the link's chain decides
  await app.open(`${PATH}?chain=all&q=${encodeURIComponent('Transactions today')}`);

  await expect(screen.getByRole('heading', TITLE)).toBeVisible(DATA);
  await expect(picker(screen, 'All chains')).toBeVisible();
  expect(asked[0]).toBe('all');
  await expect(browser).toHaveURL(pathPattern(PATH), NAVIGATION);
  expect(new URL(await browser.evaluate(() => location.href)).searchParams.get('chain')).toBe('all');
});
