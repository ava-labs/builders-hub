import { describe, expect, it } from 'vitest';

import { admit, clockPace, place, releaseOne } from '@/components/explorer-v2/network/ticker';

// a row is its block and its place in the block; newer is the higher block, then the lower index
type Row = { block: number; index: number };
const row = (block: number, index = 0): Row => ({ block, index });
const newer = (a: Row, b: Row) => b.block - a.block || a.index - b.index;
const blocks = (rows: Row[]) => rows.map((r) => `${r.block}.${r.index}`);

describe('admit', () => {
  it('paints the first batch whole, newest first, up to the window', () => {
    const { visible, queue } = admit([], [], [row(3), row(5), row(4), row(1), row(2)], 4, newer);
    expect(blocks(visible)).toEqual(['5.0', '4.0', '3.0', '2.0']);
    expect(queue).toEqual([]);
  });

  it('queues a newcomer newer than the top row, oldest first, after the rows already waiting', () => {
    const { visible, queue } = admit([row(10), row(9)], [row(11)], [row(13), row(12), row(11, 1)], 2, newer);
    expect(blocks(visible)).toEqual(['10.0', '9.0']);
    // 11.1 is older than 11.0, the newest row waiting: it is let go
    expect(blocks(queue)).toEqual(['11.0', '12.0', '13.0']);
  });

  it('fills a short window from newcomers older than its last row, and lets the ones in between go', () => {
    const { visible, queue } = admit([row(20), row(18)], [], [row(19), row(17), row(16), row(15)], 4, newer);
    expect(blocks(visible)).toEqual(['20.0', '18.0', '17.0', '16.0']);
    expect(queue).toEqual([]);
  });

  it('lets older newcomers go once the window is full', () => {
    const { visible } = admit([row(20), row(19)], [], [row(18), row(17)], 2, newer);
    expect(blocks(visible)).toEqual(['20.0', '19.0']);
  });

  it('opens full when the stream lands before the indexer', () => {
    // the stream's first read: three blocks, five transactions
    const stream = [row(102, 0), row(102, 1), row(101, 0), row(100, 0), row(100, 1)];
    const first = admit([], [], stream, 11, newer);
    expect(first.visible).toHaveLength(5);
    // the indexer's page trails the chain: its rows are the stream's and older
    const page = Array.from({ length: 11 }, (_, i) => row(100 - Math.floor(i / 2), i % 2));
    const seen = new Set(blocks(stream));
    const fresh = page.filter((r) => !seen.has(`${r.block}.${r.index}`));
    const next = admit(first.visible, first.queue, fresh, 11, newer);
    expect(next.visible).toHaveLength(11);
    expect(blocks(next.visible).slice(0, 6)).toEqual(['102.0', '102.1', '101.0', '100.0', '100.1', '99.0']);
    expect(next.queue).toEqual([]);
  });

  it('keeps the indexer rows on screen and queues the stream rows newer than them', () => {
    const page = Array.from({ length: 11 }, (_, i) => row(200 - i));
    const first = admit([], [], page, 11, newer);
    const next = admit(first.visible, first.queue, [row(202), row(201), row(200, 1)], 11, newer);
    expect(blocks(next.visible)).toEqual(blocks(first.visible));
    expect(blocks(next.queue)).toEqual(['201.0', '202.0']);
  });
});

describe('admit, with a lag', () => {
  // a row's time: one block a second
  const lag = { ms: 3_000, at: (r: Row) => r.block * 1_000 };

  it('queues a newcomer older than the top row, within the lag, at its place by time', () => {
    // 9.0 comes from a feed that runs behind: older than the top row, still kept, and first out
    const { visible, queue } = admit([row(10), row(8)], [row(11)], [row(12), row(9)], 2, newer, lag);
    expect(blocks(visible)).toEqual(['10.0', '8.0']);
    expect(blocks(queue)).toEqual(['9.0', '11.0', '12.0']);
  });

  it('lets a newcomer go when it is older than the top row by more than the lag', () => {
    // 6.0 is 4 s behind the top row: a quiet chain's last block, not news
    const { queue } = admit([row(10), row(9)], [], [row(11), row(6)], 2, newer, lag);
    expect(blocks(queue)).toEqual(['11.0']);
  });

  it('lets a newcomer go when it would land under a full window', () => {
    // 8.0 is within the lag, but older than every row on a full board: it would never show
    const { queue } = admit([row(10), row(9)], [], [row(8), row(9, 1)], 2, newer, lag);
    expect(blocks(queue)).toEqual([]);
  });

  it('still paints the first batch whole', () => {
    const { visible, queue } = admit([], [], [row(3), row(5), row(4)], 2, newer, lag);
    expect(blocks(visible)).toEqual(['5.0', '4.0']);
    expect(queue).toEqual([]);
  });

  it('still fills a short window from below, and queues the rest', () => {
    // a chain that answers after the opening frame: two rows fit beneath, the others wait
    const { visible, queue } = admit(
      [row(20), row(18)],
      [],
      [row(21), row(19), row(17), row(16), row(15)],
      4,
      newer,
      lag,
    );
    expect(blocks(visible)).toEqual(['20.0', '18.0', '17.0', '16.0']);
    expect(blocks(queue)).toEqual(['19.0', '21.0']);
  });
});

describe('place', () => {
  const board = [row(10), row(8), row(6)];

  it('puts a row newer than the top at the top', () => {
    expect(blocks(place(board, row(11), 3, newer)!)).toEqual(['11.0', '10.0', '8.0']);
  });

  it('puts an older row in at its place by time, and the last row slides out', () => {
    expect(blocks(place(board, row(9), 3, newer)!)).toEqual(['10.0', '9.0', '8.0']);
    expect(blocks(place(board, row(7), 4, newer)!)).toEqual(['10.0', '8.0', '7.0', '6.0']);
  });

  it('puts a row of the same time under the row already there', () => {
    expect(blocks(place(board, row(8, 0), 4, newer)!)).toEqual(['10.0', '8.0', '8.0', '6.0']);
  });

  it('gives null for a row that would land under a full window', () => {
    expect(place(board, row(5), 3, newer)).toBeNull();
    expect(blocks(place(board, row(5), 4, newer)!)).toEqual(['10.0', '8.0', '6.0', '5.0']);
  });
});

describe('releaseOne', () => {
  const lag = { ms: 30_000, at: (r: Row) => r.block * 1_000 };

  it('puts the next row in at the top, without a lag', () => {
    const out = releaseOne([row(10), row(9)], [row(8), row(11)], 2, newer);
    expect(blocks(out.visible!)).toEqual(['8.0', '10.0']);
    expect(blocks(out.queue)).toEqual(['11.0']);
  });

  it('puts the next row in at its place by time, with a lag', () => {
    const out = releaseOne([row(10), row(8)], [row(9), row(11)], 3, newer, lag);
    expect(blocks(out.visible!)).toEqual(['10.0', '9.0', '8.0']);
    expect(blocks(out.queue)).toEqual(['11.0']);
  });

  it('lets a row go that the window has moved past, and shows the next', () => {
    const out = releaseOne([row(10), row(9)], [row(7), row(11)], 2, newer, lag);
    expect(blocks(out.visible!)).toEqual(['11.0', '10.0']);
    expect(out.queue).toEqual([]);
  });

  it('gives null when no row waiting would show', () => {
    const out = releaseOne([row(10), row(9)], [row(7), row(8)], 2, newer, lag);
    expect(out.visible).toBeNull();
    expect(out.queue).toEqual([]);
  });

  it('skips to the newest window when far behind', () => {
    const queue = Array.from({ length: 7 }, (_, i) => row(11 + i));
    const out = releaseOne([row(10), row(9)], queue, 2, newer, lag);
    // more than twice the window waits: the oldest go, the newest window stays
    expect(blocks(out.visible!)).toEqual(['16.0', '10.0']);
    expect(blocks(out.queue)).toEqual(['17.0']);
  });
});

describe('clockPace', () => {
  const EVERY = 5_000;

  it('spreads a batch over the interval and a tenth', () => {
    expect(clockPace(EVERY, 0, 0, 5)).toBe(1_100);
  });

  it('gives the rows left the time left, and one row no more than an interval', () => {
    expect(clockPace(EVERY, 0, 3_300, 2)).toBe(1_100);
    expect(clockPace(EVERY, 10_000, 0, 1)).toBe(EVERY);
  });

  it('lets a backlog catch up at the floor', () => {
    // the tape was held under the pointer past the next poll
    expect(clockPace(EVERY, 0, 9_000, 30)).toBe(150);
  });

  // The overview's feed: one batch per 5 s sweep, of 3 to 8 rows, landing up to 0.9 s late.
  // Rows released at clockPace never stand still between sweeps.
  it('keeps a tape of 5 s batches moving, with no pause over 2 s', () => {
    const sizes = [5, 7, 3, 6, 8, 4, 6, 5, 7, 3, 8, 6];
    const late = [0, 400, 900, 100, 0, 700, 200, 900, 0, 300, 600, 0];
    const batches = sizes.map((n, i) => ({ at: i * EVERY + late[i], n }));
    const released: number[] = [];
    let waiting = 0;
    let lastBatch = 0;
    let lastRelease = 0;
    let next = Infinity;
    // each step takes the next event: a batch lands, or the next row is released
    for (let b = 0; b < batches.length || waiting > 0; ) {
      let landed = false;
      if (b < batches.length && batches[b].at <= next) {
        waiting += batches[b].n;
        lastBatch = batches[b].at;
        if (released.length === 0) lastRelease = lastBatch;
        b += 1;
        landed = true;
      } else {
        waiting -= 1;
        released.push(next);
        lastRelease = next;
      }
      // as the hook does, a batch that lands waits WARM_MS (180 ms) before its first row
      const after = landed ? lastBatch + 180 : 0;
      next = waiting > 0 ? Math.max(lastRelease + clockPace(EVERY, lastBatch, lastRelease, waiting), after) : Infinity;
    }
    const gaps = released.slice(1).map((t, i) => t - released[i]);
    expect(released).toHaveLength(sizes.reduce((a, n) => a + n, 0));
    expect(Math.max(...gaps)).toBeLessThanOrEqual(2_000);
    // and a row waits about one interval at most after its batch lands
    expect(released.at(-1)! - batches.at(-1)!.at).toBeLessThanOrEqual(EVERY * 1.1);
  });
});
