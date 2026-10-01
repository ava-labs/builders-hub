import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { ExecutionLanes } from '@/components/explorer-v2/evm/ExecutionLanes';
import type { Head, StreamTx } from '@/components/explorer-v2/evm/useHeadStream';

const TIP = 1030;
// thirty heads, tip first, three transactions each
const heads: Head[] = Array.from({ length: 30 }, (_, i) => ({ number: TIP - i, hash: `0x${i}`, timestampMs: 1_759_200_000_000 + (30 - i) * 1000, txCount: 3, gasUsed: 1, gasLimit: 2, settledHeight: TIP - 6 - i }));
const tx = (block: number, txIndex: number, success: boolean): StreamTx => ({ hash: `0x${block}${txIndex}`, blockNumber: block, txIndex, timestamp: 0, from: '', to: '', value: '0', methodId: '', input: '', success, feeWei: 0 });
const lanes = (executedHeight: number | null, txs: StreamTx[] = []) =>
  renderToStaticMarkup(<ExecutionLanes heads={heads} executedHeight={executedHeight} txs={txs} live base="/explorer/mainnet/c-chain" />);

describe('the execution lanes', () => {
  it('stand the blocks accepted and not yet executed hollow, and count them in the queue', () => {
    const html = lanes(TIP - 4, [tx(TIP - 4, 0, true), tx(TIP - 4, 1, false), tx(TIP - 4, 2, true)]);
    expect(html).toContain('queue 4 · #1,027 executing');
    // the root trails the tip by six blocks, counted in blocks
    expect(html).toContain('#1,024 committed · 6 accepted');
    expect(html.match(/ring-zinc-200/g)).toHaveLength(4);
    // one reverted receipt, in red, in the block that ran it
    expect(html.match(/bg-\[#E6212F\]/g)).toHaveLength(1);
    expect(html).toContain('href="/explorer/mainnet/c-chain/block/1030"');
  });

  it('read queue 0 when execution keeps pace, with no hollow cell', () => {
    const html = lanes(TIP);
    expect(html).toContain('queue 0');
    expect(html).not.toContain('ring-zinc-200');
  });

  it('show no queue before the stream has read any receipts', () => {
    const html = lanes(null);
    expect(html).not.toMatch(/queue \d/);
    expect(html).not.toContain('ring-zinc-200');
  });

  it('never write settled, waiting, awaiting or pending', () => {
    expect(lanes(TIP - 4).toLowerCase()).not.toMatch(/settled|waiting|awaiting|pending/);
  });
});
