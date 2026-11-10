import { test, type Browser, type WebRoute } from '@e2e-dev/web';
import { expect, type App } from 'e2e';
import { answerFirstVisitPrompts } from '../lib/visitor';
import { DATA, MULTI_PAGE } from './explorer-page';

// Rule: a Query answer is a grid a reader works in with no new question. Window buttons read it again over another
// span. Each headline figure says how it moved against the period before. Findings name what stands out in the
// rows. The SQL is one click from the chart and stays open on the device. Under the grid, the answer can be set
// beside the period before it, and a chip asks one of the questions the answer raises as a follow-up.
//
// The route answers from fixtures, so no model or database runs: the question, the read of the period before
// ({ prior }), the window button ({ move }) and the chip's follow-up each get their own answer.

const PATH = '/explorer/mainnet/c-chain/query';
const QUESTION = 'transactions per hour over the last 12 hours, with reverts';
const TITLE = 'Transactions per hour in the last 12 hours';
const MOVED = 'Transactions per hour in the last 7 days';
const FOLLOW_UP = 'Which contracts reverted most?';
const FOLLOWED = 'Contracts by reverted transactions';
const SQL = 'SELECT toStartOfHour(block_time) AS t, count() AS txs, countIf(NOT success) AS reverted FROM raw_txs WHERE chain_id = 43114 AND block_time >= toStartOfHour(now()) - INTERVAL 12 HOUR GROUP BY t ORDER BY t';

const COLUMNS = [
  { name: 't', type: 'DateTime' },
  { name: 'txs', type: 'UInt64' },
  { name: 'reverted', type: 'UInt64' },
];

/** twelve hours that ended a day ago, so no hour is the one still filling; the fifth holds a peak. scale is how the
    period before stood against this one */
function rows(scale = 1) {
  const start = Math.floor(Date.now() / 3_600_000) * 3_600_000 - 36 * 3_600_000;
  return Array.from({ length: 12 }, (_, i) => {
    const txs = Math.round((i === 4 ? 9_000 : 1_000 + 40 * i) * scale);
    return { t: new Date(start + i * 3_600_000).toISOString().slice(0, 19).replace('T', ' '), txs, reverted: Math.round(txs * 0.2) };
  });
}

const result = (data: ReturnType<typeof rows>) => ({ columns: COLUMNS, rows: data, rowCount: data.length, elapsedMs: 1, rowsRead: data.length, bytesRead: 0, truncated: false, ranAt: new Date().toISOString() });

const series = (column: string, label: string) => ({ column, label, format: 'number', axis: 'left', mark: 'bar', transform: 'none', dashed: false });

/** the answer as the route streams it: its window can move, and it has a period before */
function answer(title: string, moves: object, followups?: string[]) {
  return {
    title,
    note: 'Transactions charged per hour.',
    span: 'last 12 hours',
    sql: SQL,
    anchor: null,
    coverage: null,
    drill: null,
    names: {},
    moves,
    followups,
    chart: { kind: 'bar', x: 't', series: [{ column: 'txs', label: 'Transactions' }, { column: 'reverted', label: 'Reverted' }] },
    result: result(rows()),
    visual: {
      stats: [{ label: 'Transactions', column: 'txs', agg: 'sum', format: 'number' }],
      callouts: [],
      panels: [{ title: 'Transactions and reverts', kind: 'bar', x: 't', series: [series('txs', 'Transactions'), series('reverted', 'Reverted')], markers: [], bands: [], referenceLines: [], stacked: false, sortDir: 'desc', width: 'full' }],
    },
  };
}

interface Seen {
  prompts: { prompt: string; history: number }[];
  moves: string[];
  priors: number;
}

/** answers each kind of call the page makes; any other call gets a 400, so the page keeps the fixture's layout */
async function answerFromFixtures(browser: Browser): Promise<Seen> {
  const seen: Seen = { prompts: [], moves: [], priors: 0 };
  await browser.route(/\/api\/explorer\/query$/, async (route: WebRoute) => {
    const body = JSON.parse(route.request.postData ?? '{}') as { prompt?: string; history?: unknown[]; move?: { span: string }; prior?: object };
    if (body.prompt) {
      const followUp = (body.history ?? []).length > 0;
      seen.prompts.push({ prompt: body.prompt, history: (body.history ?? []).length });
      const line = { type: 'answer', answer: followUp ? answer(FOLLOWED, { span: null, own: '12H', prior: false }) : answer(TITLE, { span: null, own: '12H', prior: true }, [FOLLOW_UP]) };
      await route.fulfill({ headers: { 'content-type': 'application/x-ndjson; charset=utf-8' }, body: `${JSON.stringify(line)}\n` });
      return;
    }
    if (body.prior) {
      seen.priors += 1;
      // the period before held half as much
      await route.fulfill({ json: { result: result(rows(0.5)), totals: null } });
      return;
    }
    if (body.move) {
      seen.moves.push(body.move.span);
      await route.fulfill({ json: { title: MOVED, note: 'Transactions charged per hour.', span: 'last 7 days', sql: SQL.replace('12 HOUR', '7 DAY'), drill: null, result: result(rows()), names: {}, totals: null, anchor: null, sources: [], moves: { span: '7d', own: null, prior: true } } });
      return;
    }
    await route.fulfill({ status: 400, json: { error: 'no fixture for this call' } });
  });
  // the schema browser of the SQL editor reads the chain's tables: none are needed here
  await browser.route(/\/api\/explorer\/query\/schema/, (route: WebRoute) => route.fulfill({ status: 502, json: { error: 'no fixture for this call' } }));
  return seen;
}

async function openAnswer(app: App, browser: Browser): Promise<Seen> {
  await app.open(PATH);
  await answerFirstVisitPrompts(browser);
  const seen = await answerFromFixtures(browser);
  await app.open(`${PATH}?q=${encodeURIComponent(QUESTION)}`);
  return seen;
}

test('an answer shows how each figure moved, what stands out, and reads again over another span', MULTI_PAGE, async ({ app, screen, browser }) => {
  const seen = await openAnswer(app, browser);
  await expect(screen.getByRole('heading', TITLE)).toBeVisible(DATA);

  // the figure against the period before, which held half as much
  await expect(screen.getByText('+100%')).toBeVisible(DATA);
  await expect(screen.getByText('vs prior 12 hours')).toBeVisible();
  expect(seen.priors).toBe(1);

  // what stands out: the hour far above the median one, and the share that reverted
  const findings = screen.getByRole('region', 'Findings');
  await expect(findings.getByText(/held 9,000 transactions, [\d.]+ times the median period\./)).toBeVisible();
  await expect(findings.getByText(/^20% of transactions reverted: /)).toBeVisible();

  // the window: the answer's own span, and the spans it can be read over again
  const window = screen.getByRole('group', 'Window');
  await expect(window.getByRole('button', '12H')).toHaveAttribute('aria-pressed', 'true');
  await window.getByRole('button', '7D').click();
  await expect(screen.getByRole('heading', MOVED)).toBeVisible(DATA);
  await expect(window.getByRole('button', '7D')).toHaveAttribute('aria-pressed', 'true');
  expect(seen.moves).toEqual(['7d']);
  // no model was asked for it
  expect(seen.prompts).toHaveLength(1);

  // back to the span the answer was first given over, with no new read
  await window.getByRole('button', '12H').click();
  await expect(screen.getByRole('heading', TITLE)).toBeVisible();
  expect(seen.moves).toEqual(['7d']);
});

test('the SQL is one click from the chart, and stays open on the device', MULTI_PAGE, async ({ app, screen, browser }) => {
  await openAnswer(app, browser);
  await expect(screen.getByRole('heading', TITLE)).toBeVisible(DATA);
  await expect(screen.getByRole('region', 'SQL')).toHaveCount(0);

  await screen.getByRole('button', 'SQL').click();
  const drawer = screen.getByRole('region', 'SQL');
  await expect(drawer.getByRole('textbox', 'SQL')).toHaveValue(SQL);
  // nothing to run until the reader changes the text
  await expect(drawer.getByRole('button', 'Run')).toBeDisabled();

  // the next answer on this device opens with its SQL in view
  await app.open(`${PATH}?q=${encodeURIComponent(QUESTION)}`);
  await expect(screen.getByRole('heading', TITLE)).toBeVisible(DATA);
  await expect(screen.getByRole('region', 'SQL').getByRole('textbox', 'SQL')).toHaveValue(SQL);
});

test('under the grid, the answer stands beside the period before, and a chip asks a follow-up', MULTI_PAGE, async ({ app, screen, browser }) => {
  const seen = await openAnswer(app, browser);
  await expect(screen.getByRole('heading', TITLE)).toBeVisible(DATA);
  const next = screen.getByRole('region', 'Next steps');

  // the period before as a line beside the bars: the chart's key names it
  const compare = next.getByRole('button', 'Compare with the prior 12 hours');
  await expect(compare).toHaveAttribute('aria-pressed', 'false', DATA);
  await compare.click();
  await expect(compare).toHaveAttribute('aria-pressed', 'true');
  await expect(screen.getByRole('region', 'Transactions and reverts').getByText('Prior 12 hours')).toBeVisible();

  // a finding raises a question, and the answer's writer offers one: each is a chip
  await expect(next.getByRole('button', /^What drove the peak at /)).toBeVisible();
  await next.getByRole('button', FOLLOW_UP).click();
  await expect(screen.getByRole('heading', FOLLOWED)).toBeVisible(DATA);
  // asked as a follow-up on the answer in view
  expect(seen.prompts).toEqual([{ prompt: QUESTION, history: 0 }, { prompt: FOLLOW_UP, history: 1 }]);
});
