import { test, type Browser, type WebRoute } from '@e2e-dev/web';
import { expect, type App } from 'e2e';
import { answerFirstVisitPrompts } from '../lib/visitor';
import { DATA, MULTI_PAGE } from './explorer-page';

// Rule: an answer about the staked share of the supply around an upgrade says where each part of it comes from. The
// page shows the server's line for each table it built (the supply per day, the filled stake) and for each day a
// table misses, under the answer's note. The "Source" fact names only the tables our server built, and the chart
// marks the upgrade.
//
// The route answers from a fixture (one NDJSON answer line), so no model or database runs; api/explorer-query-
// staking.e2e.ts checks the same answer against the live tables.

const PATH = '/explorer/mainnet/p-chain/query';
const QUESTION = 'has the % of circulating avax staked increased since the helicon upgrade';
const TITLE = 'Staked share around Helicon upgrade';
const PANEL = 'Staked share of the circulating supply';
const SUPPLY = "The supply on each day is rebuilt: the Avalanche Data API's total supply at 2026-10-16 14:15 UTC, less the staking rewards paid after that day. Burns after that day are not added back, a difference of less than 0.02% of the supply over 90 days. The Data API counts the circulating supply as equal to the total supply.";
const FILL = "The stake from 2026-08-13 to 2026-08-25 comes from the P-Chain's validator sets (platform.getValidatorsAt at each day's last block), because no validator snapshots exist for those days. Where both exist, the two are equal to the nAVAX.";
const GAP = 'No delegator snapshots exist from 2026-08-13 11:20 to 2026-08-26 12:03 UTC. The indexer stopped while the stats database moved hosts, so those days are empty.';

/** 55 days from 30 days before Helicon, the share in a steady wave so the chart has a shape without a random source */
function rows() {
  return Array.from({ length: 55 }, (_, i) => {
    const staked = Math.round((205e6 + 12e6 * Math.sin(i / 6)) * 100) / 100;
    const supply = 466.5e6 + i * 40_000;
    return { t: new Date(Date.UTC(2026, 7, 23 + i)).toISOString().slice(0, 10), staked_avax: staked, circulating_avax: supply, staked_pct: Math.round((10_000 * staked) / supply) / 100 };
  });
}

/** the route's answer line, as app/api/explorer/query streams it */
function answerLine(): string {
  const data = rows();
  const answer = {
    title: TITLE,
    note: 'Daily Primary Network stake as a share of the circulating supply, from 30 days before Helicon (activated 2026-09-22) to now. The current day is not over.',
    sql: 'SELECT s.t AS t, d.staked_avax AS staked_avax, s.circulating_supply_avax AS circulating_avax, round(100 * d.staked_avax / s.circulating_supply_avax, 2) AS staked_pct FROM p_avax_supply_daily AS s LEFT JOIN daily AS d ON d.t = s.t',
    anchor: null,
    coverage: null,
    drill: null,
    names: {},
    chart: { kind: 'line', x: 't', series: [{ column: 'staked_pct', label: 'Staked share' }] },
    result: {
      columns: [
        { name: 't', type: 'Date' },
        { name: 'staked_avax', type: 'Float64' },
        { name: 'circulating_avax', type: 'Float64' },
        { name: 'staked_pct', type: 'Float64' },
      ],
      rows: data,
      rowCount: data.length,
      elapsedMs: 1,
      rowsRead: data.length,
      bytesRead: 0,
      truncated: false,
      ranAt: new Date().toISOString(),
    },
    // the tables our server built, and a day one table misses: that line names no source of ours (no label)
    sources: [
      { table: 'p_avax_supply_daily', label: 'daily AVAX supply', at: Date.now(), total: 1, known: 1, text: SUPPLY },
      { table: 'p_stake_fill', label: 'P-Chain validator sets', at: Date.now(), total: 13, known: 13, text: FILL },
      { table: 'p_delegator_snapshots', label: '', at: Date.now(), total: 0, known: 0, text: GAP },
    ],
    visual: {
      stats: [],
      callouts: [],
      panels: [
        {
          title: PANEL,
          kind: 'line',
          x: 't',
          series: [{ column: 'staked_pct', label: 'Staked share', format: 'percent', axis: 'left', mark: 'auto', transform: 'none', dashed: false }],
          // the server's mark for the day Helicon activated (lib/explorer-query/upgrades.ts markUpgrades)
          markers: [{ x: '2026-09-22', label: 'Helicon' }],
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

test('a staked share answer says where its supply and its filled days come from, and marks the upgrade', MULTI_PAGE, async ({ app, screen, browser }) => {
  const seen = await openAnswer(app, browser);
  await expect(screen.getByRole('heading', TITLE)).toBeVisible(DATA);
  expect(seen.prompts).toEqual([QUESTION]);

  // one line per table the server built, and one for the days a table misses
  for (const line of [SUPPLY, FILL, GAP]) await expect(screen.getByText(line)).toBeVisible();

  // the chart marks the day Helicon activated
  await expect.poll(() => browser.evaluate(chartWords, PANEL), DATA).toContain('Helicon');

  // the Source fact names the tables our server built, and never a blank one for the missing days
  await screen.getByRole('button', 'How this was answered').click();
  await expect(screen.getByText('Indexed ClickHouse tables, read-only, with daily AVAX supply and P-Chain validator sets from our API')).toBeVisible();
  // the page asked once: the layout and the reading came from the fixture's answer
  expect(seen.prompts).toEqual([QUESTION]);
});
