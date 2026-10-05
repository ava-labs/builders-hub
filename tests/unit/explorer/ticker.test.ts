import { describe, expect, it } from 'vitest';

import { admit, clockPace, releaseOne } from '@/components/explorer-v2/network/ticker';

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

describe('admit, merged', () => {
  it('queues every newcomer newer than the top row at its place by time', () => {
    // 11.0 comes from a feed that answers later: older than 12.0, waiting, but newer than the top row
    const { visible, queue } = admit([row(10), row(8)], [row(12)], [row(13), row(11)], 2, newer, true);
    expect(blocks(visible)).toEqual(['10.0', '8.0']);
    expect(blocks(queue)).toEqual(['11.0', '12.0', '13.0']);
  });

  it('lets a newcomer older than the top row go, so every row goes in at the top', () => {
    // 9.0 is newer than the last row, but it would go in under the top one
    const { queue } = admit([row(10), row(8)], [], [row(11), row(9)], 2, newer, true);
    expect(blocks(queue)).toEqual(['11.0']);
  });

  it('still paints the first batch whole', () => {
    const { visible, queue } = admit([], [], [row(3), row(5), row(4)], 2, newer, true);
    expect(blocks(visible)).toEqual(['5.0', '4.0']);
    expect(queue).toEqual([]);
  });

  it('still fills a short window from below, and queues the rows newer than the top', () => {
    // a chain that answers after the opening frame: two rows fit beneath, one waits, 19.0 goes
    const { visible, queue } = admit(
      [row(20), row(18)],
      [],
      [row(21), row(19), row(17), row(16), row(15)],
      4,
      newer,
      true,
    );
    expect(blocks(visible)).toEqual(['20.0', '18.0', '17.0', '16.0']);
    expect(blocks(queue)).toEqual(['21.0']);
  });
});

describe('releaseOne', () => {
  it('puts the next row in at the top', () => {
    const out = releaseOne([row(10), row(9)], [row(11), row(12)], 2);
    expect(blocks(out.visible!)).toEqual(['11.0', '10.0']);
    expect(blocks(out.queue)).toEqual(['12.0']);
  });

  it('gives null when no row waits', () => {
    expect(releaseOne([row(10)], [], 2)).toEqual({ visible: null, queue: [] });
  });

  it('skips to the newest window when far behind', () => {
    const queue = Array.from({ length: 7 }, (_, i) => row(11 + i));
    const out = releaseOne([row(10), row(9)], queue, 2);
    // more than twice the window waits: the oldest go, the newest window stays
    expect(blocks(out.visible!)).toEqual(['16.0', '10.0']);
    expect(blocks(out.queue)).toEqual(['17.0']);
  });
});

describe('clockPace', () => {
  const EVERY = 5_000;

  it('spreads the rows waiting until 0.9 of an interval after the last batch landed', () => {
    expect(clockPace(EVERY, 0, 0, 0, 5)).toBe(900);
  });

  it('lets no row wait more than an interval and a half after it landed, while batches keep landing', () => {
    // the longest-waiting row landed at 0 and the last batch at 5 s: the five rows are out by 7.5 s, not 9.5 s
    expect(clockPace(EVERY, 0, 5_000, 0, 5)).toBe(1_500);
  });

  it('gives the rows left the time left, and one row no more than an interval', () => {
    expect(clockPace(EVERY, 0, 0, 2_700, 2)).toBe(900);
    expect(clockPace(EVERY, 10_000, 10_000, 0, 1)).toBe(EVERY);
  });

  it('lets a backlog catch up at the floor', () => {
    // the tape was held under the pointer past the next poll
    expect(clockPace(EVERY, 0, 0, 9_000, 30)).toBe(150);
  });
});

// The overview's boards: each chain's RPC read every 5 s, the chain's rows a read, merged on one board. A chain's
// newest row is 1 to 6 s old when its read lands (its block time and its RPC's lag), and the reads land at different
// times in a sweep, so a row can land after a newer one from another chain.
describe('a clocked, merged tape', () => {
  const EVERY = 5_000;
  // as useTicker's WARM_MS: a batch waits this long before its first row
  const WARM_MS = 180;
  const VISIBLE = 11;
  type Tx = { id: string; t: number };
  const txNewer = (a: Tx, b: Tx) => b.t - a.t || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

  // Each chain makes a row every `gap` ms; its feed shows a row `trail` ms after it is made, and its read lands
  // `lands` ms into each sweep (later in every third sweep). A read brings the chain's two newest rows since its
  // last read, as the overview samples them.
  const CHAINS = [
    { name: 'c', gap: 1_800, trail: 1_000, lands: 300 },
    { name: 'g', gap: 1_200, trail: 1_000, lands: 450 },
    { name: 'd', gap: 2_500, trail: 2_000, lands: 700 },
    { name: 'n', gap: 3_500, trail: 3_000, lands: 1_100 },
  ];
  function reads(sweeps: number, perRead = 2, chains = CHAINS) {
    const out: { at: number; rows: Tx[] }[] = [];
    const last = new Map<string, number>();
    for (let s = 1; s <= sweeps; s++) {
      for (const c of chains) {
        const at = s * EVERY + c.lands + (s % 3 === 0 ? 700 : 0);
        const upTo = at - c.trail;
        const from = last.get(c.name) ?? upTo - EVERY;
        last.set(c.name, upTo);
        const made: Tx[] = [];
        for (let k = Math.floor(from / c.gap) + 1; k * c.gap <= upTo; k++)
          made.push({ id: `${c.name}${k}`, t: k * c.gap });
        out.push({ at, rows: made.sort(txNewer).slice(0, perRead) });
      }
    }
    return out.sort((a, b) => a.at - b.at);
  }

  // useTicker with `every` and `merged`, on a fake clock: a batch lands (admit, then plan the next release again), or
  // the next row goes out (releaseOne, then plan the one after)
  function play(batches: { at: number; rows: Tx[] }[], merged = true) {
    let visible: Tx[] = [];
    let queue: Tx[] = [];
    let landed = new Map<string, number>();
    let lastRelease = 0;
    let lastBatch = 0;
    let next: number | null = null;
    const frames: { at: number; rows: Tx[] }[] = [];
    const waits: number[] = [];
    const arm = (now: number, fresh: boolean) => {
      if (next !== null || !queue.length) return;
      const first = Math.min(...queue.map((t) => landed.get(t.id)!));
      next = Math.max(
        now,
        lastRelease + clockPace(EVERY, first, lastBatch, lastRelease, queue.length),
        fresh ? now + WARM_MS : now,
      );
    };
    for (let b = 0; b < batches.length || next !== null; ) {
      if (next !== null && (b >= batches.length || next <= batches[b].at)) {
        const now: number = next;
        next = null;
        const out = releaseOne(visible, queue, VISIBLE);
        queue = out.queue;
        if (out.visible) {
          const fresh = out.visible.find((t) => !visible.includes(t))!;
          waits.push(now - landed.get(fresh.id)!);
          visible = out.visible;
          lastRelease = now;
          frames.push({ at: now, rows: visible.slice(0, VISIBLE - 1) });
        }
        arm(now, false);
      } else {
        const { at: now, rows } = batches[b++];
        // as the hook: a read with no new rows changes nothing
        if (!rows.length) continue;
        const opening = !visible.length;
        const placed = admit(visible, queue, rows, VISIBLE, txNewer, merged);
        visible = placed.visible;
        queue = placed.queue;
        const was = landed;
        landed = new Map(queue.map((t) => [t.id, was.get(t.id) ?? now]));
        lastBatch = now;
        if (opening) {
          lastRelease = now;
          continue;
        }
        next = null;
        arm(now, true);
      }
    }
    return { frames, waits };
  }

  const ordered = (rows: Tx[]) => rows.every((r, i) => i === 0 || rows[i - 1].t >= r.t);
  const median = (xs: number[]) => [...xs].sort((a, b) => a - b)[(xs.length - 1) >> 1];

  const letGo = (batches: { rows: Tx[] }[], frames: { rows: Tx[] }[]) => {
    const shown = new Set(frames.flatMap((f) => f.rows.map((t) => t.id)));
    return 1 - shown.size / new Set(batches.flatMap((b) => b.rows.map((t) => t.id))).size;
  };

  it('puts every row in at the top, so every frame is in time order', () => {
    const { frames } = play(reads(24));
    expect(frames.length).toBeGreaterThan(100);
    expect(frames.filter((f) => !ordered(f.rows))).toEqual([]);
    expect(frames.filter((f, i) => i > 0 && f.rows[1] !== frames[i - 1].rows[0])).toEqual([]);
  });

  it('lets few rows go: a row that lands after a newer one waits its turn', () => {
    const batches = reads(120);
    // 5.7% here, against 66% for a queue that takes only rows newer than every row waiting
    expect(letGo(batches, play(batches).frames)).toBeLessThan(0.1);
    expect(letGo(batches, play(batches, false).frames)).toBeGreaterThan(0.5);
  });

  it('keeps the tape moving: no pause over 2 s between rows', () => {
    const { frames } = play(reads(24));
    const gaps = frames.slice(1).map((f, i) => f.at - frames[i].at);
    expect(Math.max(...gaps)).toBeLessThanOrEqual(2_000);
  });

  // The pace has each row out 0.9 of an interval after the last batch, and never more than an interval and a half
  // after it landed. A batch that lands just before holds the next row WARM_MS for its names, and rows due together
  // go 150 ms apart, so a row can wait a little longer: 5.5 s at most here.
  it('lets no row wait more than about an interval and a half, over ten minutes', () => {
    const { waits } = play(reads(120));
    expect(Math.max(...waits)).toBeLessThanOrEqual(EVERY * 1.5 + 1_000);
    // and the wait does not grow: the last minute's median is the first minute's
    const perMin = Math.round(waits.length / 10);
    expect(Math.abs(median(waits.slice(-perMin)) - median(waits.slice(0, perMin)))).toBeLessThanOrEqual(250);
  });

  it('skips ahead, not behind, when the feed outruns the tape', () => {
    // 4 chains of 10 rows a read: 40 rows each 5 s, more than the floor pace (150 ms) can play
    const fast = CHAINS.map((c) => ({ ...c, gap: 100 }));
    const { frames, waits } = play(reads(60, 10, fast));
    const lagAt = (f: { at: number; rows: Tx[] }) => f.at - f.rows[0].t;
    const firstMin = frames.filter((f) => f.at > 15_000 && f.at < 75_000).map(lagAt);
    const lastMin = frames.filter((f) => f.at > 60 * EVERY - 60_000).map(lagAt);
    expect(median(lastMin) - median(firstMin)).toBeLessThanOrEqual(1_000);
    expect(Math.max(...waits)).toBeLessThanOrEqual(EVERY + 1_000);
    expect(frames.filter((f) => !ordered(f.rows))).toEqual([]);
  });
});
