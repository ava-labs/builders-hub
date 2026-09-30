import { describe, expect, it } from 'vitest';

import { admit } from '@/components/explorer-v2/network/ticker';

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
