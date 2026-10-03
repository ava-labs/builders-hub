import { test, type Browser } from '@e2e-dev/web';
import { expect, type App, type Screen } from 'e2e';
import { DATA, OVERVIEW_BLOCK_ROW } from './explorer-page';

// The All Networks overview reads each chain's blocks and transactions every 5 s. Its two boards must play the rows
// of each read as one steady tape, not as a clump followed by a pause. The tests record when each new row enters a
// board and count the pauses. Explorer data is live, so the tests check the rhythm, not the values.
//
// A pause is a gap between two rows that is longer than the board's floor (2 s for blocks, 3 s for transactions)
// and longer than 2.5 times the board's lower median gap. The second rule lets a quiet minute, with fewer rows and
// longer steps, pass. A clump followed by a pause still fails: its short gaps set the median.
//
// Thresholds, from 60 s windows of the live site on 2026-10-03 (desktop and phone):
// - Before the fix, each read's rows played in 1 to 4 s and then the board stood still: 6 to 8 pauses a minute on
//   the blocks board and 7 to 11 on the transactions board.
// - A replay of the same reads through the fix had no pauses. A dev server, with reads up to 1.8 s slow, had 0 or 1.
// - A slow read can hold up a step of the tape, so each board can have 3 pauses.
// A board that stops fails: each board must add 12 rows in the minute (one a read), and no gap can be longer than
// 10 s (two reads). With the fix a minute had 52 to 78 rows a board and no gap over 3.1 s.

// The opening read paints whole, and the chains that answer late join it. The count starts after that.
const WARM_UP_MS = 10_000;
const WINDOW_MS = 60_000;
const MAX_PAUSES = 3;
const PAUSE_TO_MEDIAN = 2.5;
const MIN_ROWS = 12;
const MAX_GAP_MS = 10_000;
const BOARDS = [
  { label: 'Latest Blocks', link: '/block/', floorMs: 2_000 },
  { label: 'Latest Transactions', link: '/tx/', floorMs: 3_000 },
];
// Longer than a read's interval (5 s), shorter than the page's read timeout (10 s)
const SLOW_READ_MS = 8_000;

const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function openOverview(app: App, screen: Screen): Promise<void> {
  await app.open('/explorer/mainnet');
  await expect(screen.getByRole('link', OVERVIEW_BLOCK_ROW).first()).toBeVisible(DATA);
}

// A role query reads the page once. To time the rows, a recorder in the page notes each row link the first time it
// appears. A row is one link per block or transaction, so the slide-out row and a redraw do not count again.
async function expectSteadyBoards(browser: Browser): Promise<void> {
  const startedAt = await browser.evaluate(
    (boards: { label: string; link: string }[]) => {
      const w = window as unknown as { __rows: Record<string, number[]> };
      w.__rows = {};
      for (const { label, link } of boards) {
        const board = [...document.querySelectorAll('section')].find(
          (s) => s.querySelector('p')?.textContent === label,
        );
        if (!board) throw new Error(`no board named ${label}`);
        const times: number[] = (w.__rows[label] = []);
        const rows = () => [...board.querySelectorAll(`a[href*="${link}"]`)].map((a) => a.getAttribute('href') ?? '');
        const seen = new Set(rows());
        new MutationObserver(() => {
          for (const href of rows()) {
            if (seen.has(href)) continue;
            seen.add(href);
            times.push(performance.now());
          }
        }).observe(board, { childList: true, subtree: true });
      }
      return performance.now();
    },
    BOARDS.map(({ label, link }) => ({ label, link })),
  );

  await pause(WARM_UP_MS + WINDOW_MS);
  const rows = await browser.evaluate(() => (window as unknown as { __rows: Record<string, number[]> }).__rows);

  const start = startedAt + WARM_UP_MS;
  const end = start + WINDOW_MS;
  // Soft checks, so a failure reports both boards
  for (const { label, floorMs } of BOARDS) {
    const added = rows[label].filter((t) => t >= start && t < end);
    expect.soft(added.length, `${label}: rows added in ${WINDOW_MS / 1000} s`).toBeGreaterThanOrEqual(MIN_ROWS);
    const edges = [start, ...added, end];
    const gaps = edges.slice(1).map((t, i) => Math.round(t - edges[i]));
    const median = [...gaps].sort((a, b) => a - b)[(gaps.length - 1) >> 1];
    const pauseMs = Math.max(floorMs, PAUSE_TO_MEDIAN * median);
    const pauses = gaps.filter((g) => g > pauseMs);
    const seen = `(gaps in ms: ${gaps.join(' ')})`;
    expect
      .soft(pauses.length, `${label}: pauses over ${pauseMs} ms in ${WINDOW_MS / 1000} s ${seen}`)
      .toBeLessThanOrEqual(MAX_PAUSES);
    expect.soft(Math.max(...gaps), `${label}: longest gap ${seen}`).toBeLessThanOrEqual(MAX_GAP_MS);
  }
}

test('overview boards add rows at a steady pace', { timeout: 300_000 }, async ({ app, screen, browser }) => {
  await openOverview(app, screen);
  await expectSteadyBoards(browser);
});

// A slow chain must hold back only its own rows. The C-Chain is always on the boards (it is the busiest chain), and
// its block reads answer late here. Before the fix, each read of every chain waited for the slowest chain.
test(
  'overview boards keep their pace while one chain answers slowly',
  { timeout: 300_000 },
  async ({ app, screen, browser }) => {
    await openOverview(app, screen);
    await browser.route(/\/api\/explorer\/43114\?blocksOnly=true/, async (route) => {
      await pause(SLOW_READ_MS);
      await route.continue();
    });
    await expectSteadyBoards(browser);
  },
);
