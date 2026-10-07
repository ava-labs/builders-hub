import { test, type Browser, type WebRoute } from '@e2e-dev/web';
import { expect, type App, type Screen } from 'e2e';
import { answerFirstVisitPrompts } from '../lib/visitor';
import { DATA, MULTI_PAGE } from './explorer-page';

// Every word a Query chart draws (a marker's "so far", a band's name, an axis tick, a node's name) stays whole
// inside the chart's svg, which cuts what runs past its edge. On 2026-10-06 the "so far" marker over the last minute
// of a line read "so fa": centered on the line, the label ran past the svg's right edge.
//
// The test answers each question from a fixture (the route streams one NDJSON answer line), so the chart shape is
// fixed and no model or database runs. It opens one answer for each row shape, switches each panel through every view
// it offers, and measures each <text> of each chart against the chart's svg.

const PATH = '/explorer/mainnet/c-chain/query';
const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// Widths a chart is drawn at: phones, a tablet, laptops, a wide screen. Recharts places the first and last point of a
// line by floating point, and at some widths that point fell a hair outside the plot, which dropped its marker.
const WIDTHS = [320, 360, 375, 414, 768, 1024, 1280, 1440, 1920];
const MINUTE = 60_000;
const HOUR = 3_600_000;
const DAY = 86_400_000;

type Row = Record<string, string | number>;
type Series = { column: string; label: string; format?: string; dashed?: boolean; axis?: 'left' | 'right' };
type Panel = {
  title: string;
  kind: 'line' | 'area' | 'bar' | 'hbar' | 'scatter' | 'flow';
  x: string;
  target?: string;
  series: Series[];
  markers?: { x: string; label: string }[];
  bands?: { from: string; to: string; label: string }[];
  referenceLines?: { y: number; label: string }[];
  width?: 'full' | 'half';
};
type Fixture = { sql: string; rows: Row[]; panels: Panel[]; names?: Record<string, Record<string, string>> };

/** a UTC time as the rows write it: 2026-10-06 14:05:00 */
const utc = (ms: number) => new Date(ms).toISOString().slice(0, 19).replace('T', ' ');
/** a steady wave, so a chart has peaks without a random source */
const wave = (i: number, base: number, amp: number) => Math.round((base + amp * Math.sin(i / 5) + amp * 0.4 * Math.cos(i / 2.3)) * 100) / 100;
const address = (i: number) => `0x${String(i + 1).padStart(2, '0').repeat(20)}`;

// The questions. Each builds its rows from the clock when the route answers, so the last bucket is the one still
// filling, and the page labels it "so far".
const QUESTIONS: Record<string, () => Fixture> = {
  'Base fee per minute': () => {
    const last = Math.floor(Date.now() / MINUTE) * MINUTE;
    // two hours and the minute the window starts in: that first minute begins before the window, so it is partial
    const rows = Array.from({ length: 121 }, (_, i) => {
      const t = last - (120 - i) * MINUTE;
      return { t: utc(t), avg_fee: wave(i, 6, 2), max_fee: wave(i, 8, 3), min_fee: wave(i, 4, 1), top_fee: wave(i, 0.9, 0.6) };
    });
    const t = (i: number) => String(rows[i].t);
    return {
      sql: 'SELECT toStartOfMinute(block_time) AS t, avg(base_fee) AS avg_fee, max(base_fee) AS max_fee, min(base_fee) AS min_fee, max(fee) AS top_fee FROM raw_blocks WHERE block_time >= now() - INTERVAL 2 HOUR GROUP BY t ORDER BY t',
      rows,
      panels: [
        {
          title: 'Base fee per minute',
          kind: 'line',
          x: 't',
          series: [
            { column: 'avg_fee', label: 'Avg base fee (nAVAX)' },
            { column: 'max_fee', label: 'Max base fee (nAVAX)', dashed: true },
            { column: 'min_fee', label: 'Min base fee (nAVAX)', dashed: true },
          ],
        },
        {
          title: 'Top transaction fee',
          kind: 'bar',
          x: 't',
          series: [{ column: 'top_fee', label: 'Top fee', format: 'avax' }],
          // the longest label a marker takes: a designer's 28 characters and the edge's word
          markers: [{ x: t(120), label: 'Peak fee of the whole window' }],
          bands: [{ from: t(113), to: t(120), label: 'Spike after the upgrade' }],
        },
      ],
    };
  },
  'Transactions per hour': () => {
    const last = Math.floor(Date.now() / HOUR) * HOUR;
    const rows = Array.from({ length: 13 }, (_, i) => ({ t: utc(last - (12 - i) * HOUR), txs: wave(i, 90_000, 20_000), gas: wave(i, 4e9, 1e9) }));
    return {
      sql: 'SELECT toStartOfHour(block_time) AS t, count() AS txs, sum(gas_used) AS gas FROM raw_txs WHERE block_time >= now() - INTERVAL 12 HOUR GROUP BY t ORDER BY t',
      rows,
      panels: [
        { title: 'Transactions per hour', kind: 'line', x: 't', series: [{ column: 'txs', label: 'Transactions' }], width: 'half' },
        { title: 'Gas used per hour', kind: 'area', x: 't', series: [{ column: 'gas', label: 'Gas used', format: 'gas' }], width: 'half' },
      ],
    };
  },
  'Transactions per day': () => {
    const today = Math.floor(Date.now() / DAY) * DAY;
    const rows = Array.from({ length: 8 }, (_, i) => ({ d: utc(today - (7 - i) * DAY).slice(0, 10), txs: wave(i, 2_100_000, 300_000) }));
    return {
      sql: 'SELECT toDate(block_time) AS d, count() AS txs FROM raw_txs WHERE block_time >= today() - 7 GROUP BY d ORDER BY d',
      rows,
      panels: [{ title: 'Transactions per day', kind: 'bar', x: 'd', series: [{ column: 'txs', label: 'Transactions' }] }],
    };
  },
  'Top senders by fees paid': () => {
    const rows = Array.from({ length: 10 }, (_, i) => ({ sender: address(i), fees: Math.round((120 - i * 11) * 100) / 100 }));
    const named = ['Trader Joe Liquidity Book Router', 'Pharaoh Exchange Universal Router', 'LayerZero Endpoint Executor'];
    return {
      sql: 'SELECT from_address AS sender, sum(fee) AS fees FROM raw_txs WHERE block_time >= now() - INTERVAL 1 DAY GROUP BY sender ORDER BY fees DESC LIMIT 10',
      rows,
      names: { sender: Object.fromEntries(named.map((n, i) => [address(i), n])) },
      panels: [
        {
          title: 'Top senders by fees paid',
          kind: 'hbar',
          x: 'sender',
          series: [{ column: 'fees', label: 'Fees paid', format: 'avax' }],
          referenceLines: [{ y: 70.5, label: 'Average of the top 10' }],
        },
      ],
    };
  },
  'Fee against gas used': () => {
    const rows = Array.from({ length: 60 }, (_, i) => ({ gas_used: 21_000 + i * 48_000, fee: wave(i, 0.02, 0.012) + i * 0.0005 }));
    return {
      sql: 'SELECT gas_used, fee FROM raw_txs WHERE block_time >= now() - INTERVAL 1 HOUR ORDER BY fee DESC LIMIT 60',
      rows,
      panels: [{ title: 'Fee against gas used', kind: 'scatter', x: 'gas_used', series: [{ column: 'fee', label: 'Fee', format: 'avax' }] }],
    };
  },
  'Where AVAX flowed': () => {
    const from = [address(0), address(1), address(2)];
    const to = [address(10), address(11), address(12)];
    const rows = from.flatMap((f, i) => to.map((t, j) => ({ from_address: f, to_address: t, amount: 1_250_000 - i * 300_000 - j * 90_000 })));
    const names = { from_address: { [from[0]]: 'Binance Hot Wallet Number Twenty' }, to_address: { [to[0]]: 'Coinbase Prime Custody Deposit' } };
    return {
      sql: 'SELECT from_address, to_address, sum(value) AS amount FROM raw_txs WHERE block_time >= now() - INTERVAL 1 DAY GROUP BY from_address, to_address',
      rows,
      names,
      panels: [{ title: 'Where AVAX flowed', kind: 'flow', x: 'from_address', target: 'to_address', series: [{ column: 'amount', label: 'AVAX', format: 'avax' }] }],
    };
  },
};

/** the route's answer line for a question, as app/api/explorer/query streams it */
function answerLine(title: string): string {
  const { sql, rows, panels, names } = QUESTIONS[title]();
  const columns = Object.keys(rows[0]).map((name) => ({ name, type: typeof rows[0][name] === 'number' ? 'Float64' : 'String' }));
  const answer = {
    title,
    note: 'A fixture answer.',
    sql,
    anchor: null,
    coverage: null,
    drill: null,
    names: names ?? {},
    chart: { kind: panels[0].kind, x: panels[0].x, series: panels[0].series.map(({ column, label }) => ({ column, label })) },
    result: { columns, rows, rowCount: rows.length, elapsedMs: 1, rowsRead: rows.length, bytesRead: 0, truncated: false, ranAt: new Date().toISOString() },
    visual: {
      stats: [],
      callouts: [],
      panels: panels.map((p) => ({
        markers: [],
        bands: [],
        referenceLines: [],
        stacked: false,
        sortDir: 'desc',
        width: 'full',
        ...p,
        series: p.series.map((s) => ({ format: 'number', axis: 'left', mark: 'auto', transform: 'none', dashed: false, ...s })),
      })),
    },
  };
  return `${JSON.stringify({ type: 'answer', answer })}\n`;
}

/** answers each question from its fixture; any other call to the route fails, and the test says which */
async function answerFromFixtures(browser: Browser): Promise<string[]> {
  const unexpected: string[] = [];
  await browser.route(/\/api\/explorer\/query$/, async (route: WebRoute) => {
    const body = JSON.parse(route.request.postData ?? '{}') as { prompt?: string };
    if (body.prompt && body.prompt in QUESTIONS) {
      // the minute chart's edges move at each minute: answer between 2 s and 50 s into one, so its first minute
      // starts before the window and its last is still filling when the page draws it
      const into = Date.now() % MINUTE;
      if (body.prompt === 'Base fee per minute' && (into < 2000 || into > 50_000)) await pause(MINUTE - into + 2000);
      await route.fulfill({ headers: { 'content-type': 'application/x-ndjson; charset=utf-8' }, body: answerLine(body.prompt) });
      return;
    }
    unexpected.push((route.request.postData ?? '').slice(0, 120));
    await route.fulfill({ status: 400, json: { error: 'no fixture for this call' } });
  });
  return unexpected;
}

type Read = { labels: string[]; ticks: string[]; problems: string[] };

// Returns null until the panel named `title` has drawn a chart and its words have not moved for `settleMs`. Then
// returns the panel's marker labels, its x axis ticks, and each word that runs past its svg, with the px it runs past.
// The browser runs this function, so it uses no helpers from this file.
function readPanel([title, settleMs]: [string, number]): Read | null {
  const panel = document.querySelector(`section[aria-label="${CSS.escape(title)}"]`);
  // the charts' svgs, not the switcher's icons; a pie draws no words in its svg
  const svgs = panel ? [...panel.querySelectorAll('svg.recharts-surface')] : [];
  if (!svgs.length) return null;
  const words = svgs.flatMap((svg) => [...svg.querySelectorAll('text')].map((t) => ({ svg, t, r: t.getBoundingClientRect() })));
  const shape = words.map(({ t, r }) => `${t.textContent}@${Math.round(r.left)},${Math.round(r.top)}`).join('|');
  const seen = window as unknown as { queryLabels?: Record<string, { shape: string; since: number }> };
  seen.queryLabels ??= {};
  if (seen.queryLabels[title]?.shape !== shape) seen.queryLabels[title] = { shape, since: performance.now() };
  if (performance.now() - seen.queryLabels[title].since < settleMs) return null;

  const problems: string[] = [];
  for (const { svg, t, r } of words) {
    if (!r.width || !r.height) continue;
    const box = svg.getBoundingClientRect();
    const past = { left: box.left - r.left, right: r.right - box.right, top: box.top - r.top, bottom: r.bottom - box.bottom };
    for (const [edge, px] of Object.entries(past)) {
      if (px > 0.5) problems.push(`"${t.textContent}" runs ${Math.round(px)} px past the ${edge} edge`);
    }
  }
  const text = (sel: string) => svgs.flatMap((s) => [...s.querySelectorAll(sel)].map((t) => t.textContent ?? ''));
  return { labels: text('.recharts-reference-line text'), ticks: text('.xAxis text'), problems };
}

const SETTLE_MS = 600;
const DRAWN = { timeout: 30_000 };

/** the panel's words once they have settled */
async function settled(browser: Browser, title: string): Promise<Read> {
  let read: Read | null = null;
  await expect
    .poll(async () => {
      read = await browser.evaluate(readPanel, [title, SETTLE_MS] as [string, number]);
      return read !== null;
    }, DRAWN)
    .toBe(true);
  return read!;
}

// The views a chart can switch to. The switcher also holds toggles (log scale, running total), and a table draws no svg.
const VIEWS = ['Line', 'Area', 'Columns', 'Bars', 'Pie', 'Scatter'];

/** the chart views a panel's switcher offers, in its order */
async function viewsOf(browser: Browser, title: string): Promise<string[]> {
  const labels = await browser.evaluate(
    (t) => [...document.querySelectorAll(`[role="group"][aria-label="View ${CSS.escape(t)} as"] button[aria-pressed]`)].map((b) => b.getAttribute('aria-label') ?? ''),
    title,
  );
  return labels.filter((l) => VIEWS.includes(l));
}

/** shows the panel in a view, and forgets the words read in the view before */
async function showView(screen: Screen, browser: Browser, title: string, view: string): Promise<void> {
  await browser.evaluate((t) => {
    delete (window as unknown as { queryLabels?: Record<string, unknown> }).queryLabels?.[t];
    return null;
  }, title);
  const button = screen.getByRole('group', `View ${title} as`).getByRole('button', view);
  await button.tap();
  await expect(button).toHaveAttribute('aria-pressed', 'true');
}

/** opens the question's answer and returns every word that runs past its chart, in each view of each panel */
async function wordsPastTheFrame(screen: Screen, browser: Browser, question: string): Promise<{ problems: string[]; labels: Record<string, string[]> }> {
  const problems: string[] = [];
  const labels: Record<string, string[]> = {};
  const { panels } = QUESTIONS[question]();
  // the route can hold the minute answer up to 12 s (answerFromFixtures)
  await expect(screen.getByRole('heading', question)).toBeVisible(DATA);
  for (const { title } of panels) {
    // a flow has no switcher: it is drawn one way
    const views = await viewsOf(browser, title);
    for (const view of views.length ? views : ['']) {
      if (view) await showView(screen, browser, title, view);
      const read = await settled(browser, title);
      labels[`${title} ${view}`.trim()] = read.labels;
      problems.push(...read.problems.map((p) => `${title}, ${view || 'flow'}: ${p}`));
    }
  }
  return { problems, labels };
}

async function openAnswer(app: App, browser: Browser, question: string): Promise<string[]> {
  await app.open(PATH);
  await answerFirstVisitPrompts(browser);
  const unexpected = await answerFromFixtures(browser);
  await app.open(`${PATH}?q=${encodeURIComponent(question)}`);
  return unexpected;
}

test('a minute chart names its edges in full: "partial" and "so far" stay inside the chart', MULTI_PAGE, async ({ app, screen, browser }) => {
  const question = 'Base fee per minute';
  const unexpected = await openAnswer(app, browser, question);
  const { problems, labels } = await wordsPastTheFrame(screen, browser, question);
  expect(problems).toEqual([]);
  for (const view of ['Line', 'Area', 'Columns']) {
    expect([...labels[`Base fee per minute ${view}`]].sort()).toEqual(['partial', 'so far']);
    expect([...labels[`Top transaction fee ${view}`]].sort()).toEqual(['Peak fee of the whole window, so far', 'partial']);
  }
  // a line puts its first and last points on the plot's edges: at every width both markers show, whole
  await showView(screen, browser, question, 'Line');
  for (const width of WIDTHS) {
    await browser.setViewport({ width, height: 900 });
    await browser.evaluate((t) => {
      delete (window as unknown as { queryLabels?: Record<string, unknown> }).queryLabels?.[t];
      return null;
    }, question);
    const read = await settled(browser, question);
    expect({ width, labels: [...read.labels].sort(), problems: read.problems }).toEqual({ width, labels: ['partial', 'so far'], problems: [] });
  }
  expect(unexpected).toEqual([]);
});

for (const question of ['Transactions per hour', 'Transactions per day', 'Top senders by fees paid', 'Fee against gas used', 'Where AVAX flowed']) {
  test(`every word of the "${question}" charts stays inside the chart, in each view`, MULTI_PAGE, async ({ app, screen, browser }) => {
    const unexpected = await openAnswer(app, browser, question);
    const { problems } = await wordsPastTheFrame(screen, browser, question);
    expect(problems).toEqual([]);
    expect(unexpected).toEqual([]);
  });
}

// Runs in the page: the ticks that do not read as the browser's own clock (14:05) of a minute in the last three hours.
function offTheBrowserClock(ticks: string[]): string[] {
  const clocks = new Set<string>();
  for (let t = Date.now() - 3 * 3_600_000; t <= Date.now() + 60_000; t += 60_000) {
    clocks.add(new Date(t).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }));
  }
  return ticks.filter((t) => !clocks.has(t));
}

// The rows write UTC. A chart of minutes or hours reads in the viewer's zone, as the node page's hours do, and a chart
// of days keeps the UTC day it counts. In a browser that runs in UTC the two zones agree, and the check passes either way.
test("the x axis reads in the viewer's time zone, and a day stays the UTC day it counts", MULTI_PAGE, async ({ app, screen, browser }) => {
  const unexpected = await openAnswer(app, browser, 'Base fee per minute');
  await expect(screen.getByRole('heading', 'Base fee per minute')).toBeVisible(DATA);
  const minutes = await settled(browser, 'Base fee per minute');
  expect(minutes.ticks.length).toBeGreaterThan(1);
  expect(await browser.evaluate(offTheBrowserClock, minutes.ticks)).toEqual([]);

  await app.open(`${PATH}?q=${encodeURIComponent('Transactions per day')}`);
  await expect(screen.getByRole('heading', 'Transactions per day')).toBeVisible(DATA);
  const days = await settled(browser, 'Transactions per day');
  const utcDays = Array.from({ length: 10 }, (_, i) => utc(Date.now() - i * DAY).slice(5, 10));
  expect(days.ticks.length).toBeGreaterThan(1);
  expect(days.ticks.filter((t) => !utcDays.includes(t))).toEqual([]);
  expect(unexpected).toEqual([]);
});
