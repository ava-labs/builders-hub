import { test, type Browser, type WebRoute } from '@e2e-dev/web';
import { expect, type Locator, type Screen } from 'e2e';
import { desktopOnly, isPhoneLayout, phoneOnly } from '../lib/skip';
import { DATA, MULTI_PAGE } from './explorer-page';

// Rule: each question on a Query page has a tab. A tab keeps its question, its refinements and its answer, so a
// switch to it, or a reload of the page, draws the answer again and sends no call to the query route: no question,
// no layout, no reading, no SQL. New question opens a tab. History lists the page's past questions, newest first: one
// opens in a tab, and one can be deleted. Each Query page keeps its own tabs and history. History is a column on a
// wide screen, which the reader can close, and a drawer on a phone.
//
// The route answers each question from a fixture, so no model or database runs. Each fixture is a kept answer (a
// recipe key, model.cached), so the page asks the route to write its reading once per question, as it does on
// production; the route answers that call 400 and the page keeps the fixture's layout. The test keeps every call to
// the route, so a switch or a reload that ran any stage again would show.

const PATH = '/explorer/mainnet/c-chain/query';
const PCHAIN_PATH = '/explorer/mainnet/p-chain/query';
const FIRST = 'Transactions per hour today';
const SECOND = 'Top senders by fees paid today';
const PCHAIN = 'Validators that joined this week';
const TITLES: Record<string, string> = { [FIRST]: 'Transactions per hour', [SECOND]: 'Top senders by fees paid', [PCHAIN]: 'Validators that joined' };

/** the route's answer line for a question: a column chart of hours, or a ranking */
function answerLine(question: string): string {
  const title = TITLES[question];
  const hours = question === FIRST;
  const hour = 3_600_000;
  const last = Math.floor(Date.now() / hour) * hour;
  const rows = hours
    ? Array.from({ length: 13 }, (_, i) => ({ t: new Date(last - (12 - i) * hour).toISOString().slice(0, 19).replace('T', ' '), txs: 80_000 + ((i * 7919) % 20_000) }))
    : Array.from({ length: 8 }, (_, i) => ({ who: `0x${String(i + 1).padStart(2, '0').repeat(20)}`, n: 120 - i * 11 }));
  const [x, y] = hours ? ['t', 'txs'] : ['who', 'n'];
  const kind = hours ? 'bar' : 'hbar';
  const answer = {
    title,
    note: 'A fixture answer.',
    sql: hours
      ? 'SELECT toStartOfHour(block_time) AS t, count() AS txs FROM raw_txs WHERE block_time >= today() GROUP BY t ORDER BY t'
      : 'SELECT from_address AS who, sum(fee) AS n FROM raw_txs WHERE block_time >= today() GROUP BY who ORDER BY n DESC LIMIT 8',
    // a kept recipe: the page asks for its reading once the rows are in
    key: `fixture:${question}`,
    model: { steps: 0, ms: 5, tries: 0, cached: true },
    anchor: null,
    coverage: null,
    drill: null,
    names: {},
    chart: { kind, x, series: [{ column: y, label: y }] },
    result: { columns: [{ name: x, type: 'String' }, { name: y, type: 'Float64' }], rows, rowCount: rows.length, elapsedMs: 1, rowsRead: rows.length, bytesRead: 0, truncated: false, ranAt: new Date().toISOString() },
    visual: {
      stats: [],
      callouts: [],
      panels: [{ title, kind, x, series: [{ column: y, label: y, format: 'number', axis: 'left', mark: 'auto', transform: 'none', dashed: false }], markers: [], bands: [], referenceLines: [], stacked: false, sortDir: 'desc', width: 'full' }],
    },
  };
  return `${JSON.stringify({ type: 'answer', answer })}\n`;
}

/* Answers each question from its fixture, and keeps every call to the route by its stage: a question, its layout
   (body.key or body.design), its reading (body.key and body.reading), a run of SQL with no model (body.sql), or
   other. Every call that is not a question gets a 400. */
async function answerFromFixtures(browser: Browser): Promise<string[]> {
  const calls: string[] = [];
  await browser.route(/\/api\/explorer\/query$/, async (route: WebRoute) => {
    const body = JSON.parse(route.request.postData ?? '{}') as { prompt?: string; key?: string; reading?: boolean; design?: unknown; sql?: string };
    calls.push(body.prompt ? `question: ${body.prompt}` : body.reading ? 'reading' : body.key || body.design ? 'layout' : body.sql ? 'sql' : 'other');
    if (body.prompt && body.prompt in TITLES) {
      await route.fulfill({ headers: { 'content-type': 'application/x-ndjson; charset=utf-8' }, body: answerLine(body.prompt) });
      return;
    }
    await route.fulfill({ status: 400, json: { error: 'no fixture for this call' } });
  });
  return calls;
}

/** the calls one question makes: the question, then the reading of its kept answer */
const asked = (...questions: string[]) => questions.flatMap((q) => [`question: ${q}`, 'reading']).sort();

function tabs(screen: Screen): Locator {
  return screen.getByRole('tablist', 'Questions');
}

function answerTitle(screen: Screen, question: string): Locator {
  return screen.getByRole('heading', TITLES[question]);
}

/** the tab with this name is in view, and its answer shows */
async function inView(screen: Screen, question: string): Promise<void> {
  await expect(answerTitle(screen, question)).toBeVisible(DATA);
  await expect(tabs(screen).getByRole('tab', question)).toHaveAttribute('aria-selected', 'true');
}

/** asks a question in the prompt box of a tab with no answer */
async function ask(screen: Screen, question: string): Promise<void> {
  const box = screen.getByRole('textbox', /^Ask (Avalanche )?C-Chain about/);
  await box.fill(question);
  await box.press('Enter');
}

/** opens the first question, then the second in a new tab; waits until both questions and their readings are sent */
async function askBoth(screen: Screen, calls: string[], open: (path: string) => Promise<void>): Promise<void> {
  await open(`${PATH}?q=${encodeURIComponent(FIRST)}`);
  await inView(screen, FIRST);
  await screen.getByRole('button', 'New question').click();
  await expect(tabs(screen).getByRole('tab', 'New question')).toHaveAttribute('aria-selected', 'true');
  await ask(screen, SECOND);
  await inView(screen, SECOND);
  await expect(tabs(screen).getByRole('tab')).toHaveCount(2);
  await expect.poll(() => [...calls].sort(), DATA).toEqual(asked(FIRST, SECOND));
}

/** the history list: the column on a wide screen, the drawer on a phone (which this opens) */
async function history(screen: Screen, browser: Browser): Promise<Locator> {
  if (await isPhoneLayout(browser)) {
    await screen.getByRole('button', 'History').click();
    const drawer = screen.getByRole('dialog', 'Query history');
    await expect(drawer).toBeVisible();
    return drawer.getByRole('navigation', 'Query history');
  }
  return screen.getByRole('navigation', 'Query history');
}

test('each tab keeps its answer through a switch, a reload and a close, and calls the route for none of them', MULTI_PAGE, async ({ app, screen, browser }) => {
  const calls = await answerFromFixtures(browser);
  await askBoth(screen, calls, (path) => app.open(path));
  const before = calls.length;

  // a switch draws the kept answer, and the tab in view writes its thread to the URL. The tab shows first, then the
  // calls are read, so a call the switch sent is in the list
  await tabs(screen).getByRole('tab', FIRST).click();
  await inView(screen, FIRST);
  expect(calls).toHaveLength(before);
  expect(new URL(await browser.url()).searchParams.get('q')).toBe(FIRST);

  // a reload brings back both tabs and the tab in view
  await browser.reload();
  await inView(screen, FIRST);
  await expect(tabs(screen).getByRole('tab', SECOND)).toHaveAttribute('aria-selected', 'false');
  expect(calls).toHaveLength(before);

  // a closed tab puts the tab beside it in view
  await tabs(screen).getByRole('button', `Close ${FIRST}`).click();
  await inView(screen, SECOND);
  await expect(tabs(screen).getByRole('tab')).toHaveCount(1);
  expect(new URL(await browser.url()).searchParams.get('q')).toBe(SECOND);

  expect([...calls].sort()).toEqual(asked(FIRST, SECOND));
});

test('history lists the past questions newest first, opens one in a tab, and deletes one', MULTI_PAGE, async ({ app, screen, browser }) => {
  const calls = await answerFromFixtures(browser);
  await askBoth(screen, calls, (path) => app.open(path));
  // a closed tab's thread stays in history
  await tabs(screen).getByRole('button', `Close ${FIRST}`).click();
  await expect(tabs(screen).getByRole('tab')).toHaveCount(1);

  const list = await history(screen, browser);
  await expect(list.getByRole('listitem')).toHaveCount(2);
  await expect(list.getByRole('listitem').first()).toHaveText(SECOND);
  await list.getByRole('button', FIRST).click();
  await inView(screen, FIRST);
  await expect(tabs(screen).getByRole('tab')).toHaveCount(2);

  // an entry a tab holds puts that tab in view, and opens no second one
  const again = await history(screen, browser);
  await again.getByRole('button', SECOND).click();
  await inView(screen, SECOND);
  await expect(tabs(screen).getByRole('tab')).toHaveCount(2);

  const last = await history(screen, browser);
  await last.getByRole('button', `Delete ${FIRST}`).click();
  await expect(last.getByRole('listitem')).toHaveCount(1);
  await expect(last.getByRole('button', FIRST)).toHaveCount(0);

  // an answer opened from history calls the route for nothing
  expect([...calls].sort()).toEqual(asked(FIRST, SECOND));
});

test("a page keeps its own tabs and history: the P-Chain page's question shows on neither of the C-Chain page's", MULTI_PAGE, async ({ app, screen, browser }) => {
  const calls = await answerFromFixtures(browser);
  await app.open(`${PCHAIN_PATH}?q=${encodeURIComponent(PCHAIN)}`);
  await inView(screen, PCHAIN);
  await expect.poll(() => [...calls].sort(), DATA).toEqual(asked(PCHAIN));

  await app.open(PATH);
  await expect(tabs(screen).getByRole('tab', 'New question')).toHaveAttribute('aria-selected', 'true');
  await expect(tabs(screen).getByRole('tab')).toHaveCount(1);
  const list = await history(screen, browser);
  await expect(list.getByRole('listitem')).toHaveCount(0);

  // the P-Chain page still holds its tab and its entry, and opens the answer with no call
  await app.open(`${PCHAIN_PATH}?q=${encodeURIComponent(PCHAIN)}`);
  await inView(screen, PCHAIN);
  await expect(tabs(screen).getByRole('tab')).toHaveCount(1);
  const own = await history(screen, browser);
  await expect(own.getByRole('listitem')).toHaveCount(1);
  expect([...calls].sort()).toEqual(asked(PCHAIN));
});

test('on a wide screen history is a column the reader can close, and it stays closed after a reload', MULTI_PAGE, async ({ app, screen, browser }) => {
  await app.open(PATH);
  await desktopOnly(browser, 'the history column is the wide-screen layout');
  await expect(tabs(screen)).toBeVisible(DATA);
  const button = screen.getByRole('button', 'History');
  await expect(screen.getByRole('navigation', 'Query history')).toBeVisible();
  await expect(button).toHaveAttribute('aria-expanded', 'true');
  await button.click();
  await expect(screen.getByRole('navigation', 'Query history')).toHaveCount(0);
  await expect(button).toHaveAttribute('aria-expanded', 'false');
  await browser.reload();
  await expect(tabs(screen)).toBeVisible(DATA);
  await expect(screen.getByRole('navigation', 'Query history')).toHaveCount(0);
  await button.click();
  await expect(screen.getByRole('navigation', 'Query history')).toBeVisible();
});

test('on a phone history is a drawer over the page', MULTI_PAGE, async ({ app, screen, browser }) => {
  await app.open(PATH);
  await phoneOnly(browser, 'the history drawer is the phone layout');
  await expect(tabs(screen)).toBeVisible(DATA);
  await expect(screen.getByRole('navigation', 'Query history')).toHaveCount(0);
  await screen.getByRole('button', 'History').click();
  const drawer = screen.getByRole('dialog', 'Query history');
  await expect(drawer.getByRole('navigation', 'Query history')).toBeVisible();
  await drawer.getByRole('button', 'Close').click();
  await expect(drawer).toHaveCount(0);
});
