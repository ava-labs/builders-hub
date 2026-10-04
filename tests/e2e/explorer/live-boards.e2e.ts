import { test, type Browser } from '@e2e-dev/web';
import { expect, type App, type Screen } from 'e2e';
import { DATA, OVERVIEW_BLOCK_ROW } from './explorer-page';

// The All Networks overview reads each chain's blocks and transactions every 5 s. Its two boards must play the rows
// of each read as one steady tape, not as a clump followed by a pause, and stay current and in time order. The tests
// record each new row as it enters a board, with the Age column of the rows on screen at that moment. Explorer data
// is live, so the tests check the rhythm, the lag and the order, not the values.
//
// Steady. A pause is a gap between two rows that is longer than the board's floor (2 s for blocks, 3 s for
// transactions) and longer than 2.5 times the board's lower median gap. The second rule lets a quiet minute, with
// fewer rows and longer steps, pass. A clump followed by a pause still fails: its short gaps set the median.
// Thresholds, from 60 s windows of the live site on 2026-10-03 (desktop and phone):
// - Before the steady tape, each read's rows played in 1 to 4 s and then the board stood still: 6 to 8 pauses a
//   minute on the blocks board and 7 to 11 on the transactions board.
// - A replay of the same reads through the tape had no pauses. A dev server, with reads up to 1.8 s slow, had 0 or 1.
// - A slow read can hold up a step of the tape, so each board can have 3 pauses.
// A board that stops fails: each board must add 12 rows in the minute (one a read), and no gap can be longer than
// 10 s (two reads). With the tape a minute had 52 to 78 rows a board and no gap over 3.1 s.
//
// Current and in order. Thresholds, from replays of 13 min of recorded reads on 2026-10-04 (54 windows of 60 s,
// each also with the C-Chain's block reads 8 s late), first through the tape that played rows in the order they
// came, then through the tape that puts each row in at its place by time:
// - Order. A frame fails when a row's Age is more than 1 s above the Age of the row below it. Ages are whole
//   seconds, so rows in the same second tie, and ties pass. Rows in arrival order failed in 37 to 84 frames of
//   every minute, by 1 to 27 s; rows placed by time failed in none. So no frame may fail.
// - Lag. The Age of the top row, at each new row, is the board's lag. Blocks come from each chain's RPC: the lag
//   peaked at 7 to 9.6 s a minute in time order, and at 12 to 26 s in arrival order, so the limit is 12 s.
//   Transactions come from the indexer, which trails the chains by 8 to 22 s: the lag peaked at 17 to 30 s in time
//   order and at 26 to 54 s in arrival order, so the limit is 35 s.
// - Trend. The median lag of the window's last 20 s, less that of its first 20 s. A queue that falls behind the feed
//   grows it: one that plays a row a second while 1.33 come (the blocks board's rate) grows it by about 13 s. It was
//   -1.1 to 1.3 s on the blocks board and -5.2 to 8.5 s on the transactions board, where the indexer's lag swings,
//   so the limits are 3 s and 12 s.

// The opening read paints whole, and the chains that answer late join it. The count starts after that.
const WARM_UP_MS = 10_000;
const WINDOW_MS = 60_000;
const MAX_PAUSES = 3;
const PAUSE_TO_MEDIAN = 2.5;
const MIN_ROWS = 12;
const MAX_GAP_MS = 10_000;
// the rows a board shows; its belt holds one more for the slide-out
const SHOWN = 10;
const ORDER_SLACK_S = 1;
const BOARDS = [
  { label: 'Latest Blocks', link: '/block/', floorMs: 2_000, maxLagS: 12, maxTrendS: 3 },
  { label: 'Latest Transactions', link: '/tx/', floorMs: 3_000, maxLagS: 35, maxTrendS: 12 },
];
// Longer than a read's interval (5 s), shorter than the page's read timeout (10 s)
const SLOW_READ_MS = 8_000;

const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// "14s" -> 14, "2m" -> 120: the lower bound of what the Age column says
function ageSeconds(text: string): number {
  const m = /^(\d+)([smhd])$/.exec(text);
  if (!m) return NaN;
  return Number(m[1]) * { s: 1, m: 60, h: 3_600, d: 86_400 }[m[2] as 's' | 'm' | 'h' | 'd'];
}

const median = (xs: number[]) => [...xs].sort((a, b) => a - b)[(xs.length - 1) >> 1];

async function openOverview(app: App, screen: Screen): Promise<void> {
  await app.open('/explorer/mainnet');
  await expect(screen.getByRole('link', OVERVIEW_BLOCK_ROW).first()).toBeVisible(DATA);
}

// One new row on a board: when it entered, and the Age texts of the rows on screen then, top first
type Frame = { at: number; ages: string[] };

// A role query reads the page once. To time the rows, a recorder in the page notes each row link the first time it
// appears. A row is one link per block or transaction, so the slide-out row and a redraw do not count again. Each
// row's Age is the last cell of the row that reads like "14s".
async function expectLiveBoards(browser: Browser): Promise<void> {
  const startedAt = await browser.evaluate(
    ({ boards, shown }: { boards: { label: string; link: string }[]; shown: number }) => {
      const w = window as unknown as { __frames: Record<string, Frame[]>; __stalls: number[][] };
      w.__frames = {};
      // a page that cannot run its timers cannot run the tape: note each stall of the main thread, so a starved
      // runner can be told from a board that stood still
      w.__stalls = [];
      let beat = performance.now();
      setInterval(() => {
        const t = performance.now();
        if (t - beat > 500) w.__stalls.push([t, Math.round(t - beat)]);
        beat = t;
      }, 100);
      for (const { label, link } of boards) {
        const board = [...document.querySelectorAll('section')].find(
          (s) => s.querySelector('p')?.textContent === label,
        );
        if (!board) throw new Error(`no board named ${label}`);
        const frames: Frame[] = (w.__frames[label] = []);
        // each row's link, once, top first
        const rows = () => {
          const out = new Map<string, Element>();
          for (const a of board.querySelectorAll(`a[href*="${link}"]`)) {
            const href = a.getAttribute('href') ?? '';
            if (!out.has(href)) out.set(href, a);
          }
          return out;
        };
        // the row around a link: the widest box that holds no other row's link
        const rowOf = (a: Element) => {
          let el = a;
          while (el.parentElement && el.parentElement !== board) {
            const hrefs = new Set(
              [...el.parentElement.querySelectorAll(`a[href*="${link}"]`)].map((x) => x.getAttribute('href')),
            );
            if (hrefs.size > 1) break;
            el = el.parentElement;
          }
          return el;
        };
        const ageOf = (row: Element) => {
          const cells = [...row.querySelectorAll('span')].filter((s) =>
            /^\d+[smhd]$/.test(s.textContent?.trim() ?? ''),
          );
          return cells.at(-1)?.textContent?.trim() ?? '';
        };
        const seen = new Set(rows().keys());
        new MutationObserver(() => {
          const now = rows();
          if (![...now.keys()].some((href) => !seen.has(href))) return;
          const at = performance.now();
          const ages = [...now.values()].slice(0, shown).map((a) => ageOf(rowOf(a)));
          for (const href of now.keys()) {
            if (seen.has(href)) continue;
            seen.add(href);
            frames.push({ at, ages });
          }
        }).observe(board, { childList: true, subtree: true });
      }
      return performance.now();
    },
    { boards: BOARDS.map(({ label, link }) => ({ label, link })), shown: SHOWN },
  );

  await pause(WARM_UP_MS + WINDOW_MS);
  const { frames, stalls } = await browser.evaluate(() => {
    const w = window as unknown as { __frames: Record<string, Frame[]>; __stalls: number[][] };
    return { frames: w.__frames, stalls: w.__stalls };
  });

  const start = startedAt + WARM_UP_MS;
  const end = start + WINDOW_MS;
  const stalled = stalls.filter(([t]) => t >= start && t < end + 1_000).map(([, ms]) => ms);
  const page = `(page stalls over 0.5 s in the window: ${stalled.length ? stalled.join(' ') : 'none'})`;
  // Soft checks, so a failure reports both boards
  for (const { label, floorMs, maxLagS, maxTrendS } of BOARDS) {
    const added = frames[label].filter((f) => f.at >= start && f.at < end);
    const times = added.map((f) => f.at);
    expect.soft(times.length, `${label}: rows added in ${WINDOW_MS / 1000} s`).toBeGreaterThanOrEqual(MIN_ROWS);
    const edges = [start, ...times, end];
    const gaps = edges.slice(1).map((t, i) => Math.round(t - edges[i]));
    const middle = median(gaps);
    const pauseMs = Math.max(floorMs, PAUSE_TO_MEDIAN * middle);
    const pauses = gaps.filter((g) => g > pauseMs);
    const seen = `(gaps in ms: ${gaps.join(' ')}) ${page}`;
    expect
      .soft(pauses.length, `${label}: pauses over ${pauseMs} ms in ${WINDOW_MS / 1000} s ${seen}`)
      .toBeLessThanOrEqual(MAX_PAUSES);
    expect.soft(Math.max(...gaps), `${label}: longest gap ${seen}`).toBeLessThanOrEqual(MAX_GAP_MS);

    const ages = added.map((f) => f.ages.map(ageSeconds));
    const unread = added.filter((f, i) => f.ages.length === 0 || ages[i].some(Number.isNaN));
    expect.soft(unread.length, `${label}: frames with an Age that does not read (${unread[0]?.ages})`).toBe(0);
    const outOfOrder = added.filter((_, i) =>
      ages[i].some((a, j) => j + 1 < ages[i].length && a > ages[i][j + 1] + ORDER_SLACK_S),
    );
    expect
      .soft(
        outOfOrder.length,
        `${label}: frames with a row older than the row below it (first: ${outOfOrder[0]?.ages.join(' ')})`,
      )
      .toBe(0);
    const lag = added.map((f, i) => ({ at: f.at, s: ages[i][0] })).filter((l) => Number.isFinite(l.s));
    const lags = `(top row's Age at each new row: ${lag.map((l) => l.s).join(' ')})`;
    expect
      .soft(Math.max(...lag.map((l) => l.s)), `${label}: the most the top row lagged ${lags}`)
      .toBeLessThanOrEqual(maxLagS);
    const first = lag.filter((l) => l.at < start + WINDOW_MS / 3).map((l) => l.s);
    const last = lag.filter((l) => l.at >= end - WINDOW_MS / 3).map((l) => l.s);
    // a board with no row in a third already fails the pause and gap checks
    if (first.length && last.length) {
      expect
        .soft(median(last) - median(first), `${label}: the lag's growth over the window ${lags}`)
        .toBeLessThanOrEqual(maxTrendS);
    }
  }
}

test(
  'overview boards add rows at a steady pace, current and in time order',
  { timeout: 300_000 },
  async ({ app, screen, browser }) => {
    await openOverview(app, screen);
    await expectLiveBoards(browser);
  },
);

// A slow chain must hold back only its own rows. The C-Chain is always on the boards (it is the busiest chain), and
// its block reads answer late here. Before the steady tape, each read of every chain waited for the slowest chain.
// Its late rows go in at their place by time, under the other chains' newer rows, so the boards stay current.
test(
  'overview boards keep their pace and order while one chain answers slowly',
  { timeout: 300_000 },
  async ({ app, screen, browser }) => {
    await openOverview(app, screen);
    let held = 0;
    await browser.route(/\/api\/explorer\/43114\?blocksOnly=true/, async (route) => {
      held += 1;
      await pause(SLOW_READ_MS);
      await route.continue();
    });
    await expectLiveBoards(browser);
    // the C-Chain asks again a sweep after each held read lands: about 7 reads held in the 70 s
    expect(held, 'C-Chain block reads held').toBeGreaterThanOrEqual(4);
  },
);
