import { describe, expect, it } from 'vitest';
import { FLOW_TOP, flowOf, type Flow } from '@/components/explorer-v2/evm/query/flow';

const cols = { from: 'from_address', to: 'to_address', value: 'usdc', names: {} };
const row = (s: string, t: string, v: unknown) => ({ from_address: s, to_address: t, usdc: v });
const at = (f: Flow, key: string, copy = false) => f.nodes.find((n) => n.key === key && n.copy === copy);

// recharts' Sankey follows bands to find each column and never stops on a cycle: every band must run to a later column
const rightward = (f: Flow) => f.links.every((l) => f.nodes[l.target].depth > f.nodes[l.source].depth);
const drawn = (f: Flow) => f.links.reduce((x, l) => x + l.value, 0);

describe('flowOf', () => {
  it('sums a pair over its rows and leaves out a row it cannot draw', () => {
    const f = flowOf([row('A', 'B', 2), row('A', 'B', '3'), row('B', 'C', 4), row('C', 'C', 9), row('A', 'D', 0), row('A', '', 1), row('A', 'E', 'x')], cols);
    expect(f.skipped).toBe(4);
    expect(f.total).toBe(9);
    expect(f.links.map((l) => l.value)).toEqual([5, 4]);
    expect(f.links[0].rows).toHaveLength(2);
  });

  it('draws a chain as stages: a receiver that sends on stands between', () => {
    const f = flowOf([row('A', 'B', 10), row('B', 'C', 8)], cols);
    expect(f.mode).toBe('stages');
    expect(f.nodes.map((n) => [n.key, n.depth])).toEqual([['A', 0], ['B', 1], ['C', 2]]);
  });

  it('draws a pool with value running back as stages: the flow back ends at a copy on the right', () => {
    const f = flowOf([row('D1', 'H', 10), row('D2', 'H', 8), row('H', 'W', 6), row('H', 'D1', 3)], cols);
    expect(f.mode).toBe('stages');
    expect([at(f, 'D1')?.depth, at(f, 'D2')?.depth, at(f, 'H')?.depth, at(f, 'W')?.depth, at(f, 'D1', true)?.depth]).toEqual([0, 0, 1, 2, 2]);
    // the copy stands for the same name: its sums are the name's own
    expect(at(f, 'D1', true)).toMatchObject({ sent: 10, received: 3, drawnIn: 3 });
    expect(rightward(f)).toBe(true);
  });

  it('draws value that runs every way as senders on the left and receivers on the right', () => {
    const f = flowOf([row('A', 'B', 5), row('B', 'A', 4), row('B', 'C', 3), row('C', 'B', 2), row('C', 'A', 1), row('A', 'C', 1)], cols);
    expect(f.mode).toBe('sides');
    expect(f.depth).toBe(1);
    // each column starts with the names that carry the most
    expect(f.nodes.filter((n) => n.depth === 0).map((n) => n.key)).toEqual(['B', 'A', 'C']);
    expect(f.nodes.filter((n) => n.depth === 1).map((n) => n.key)).toEqual(['B', 'A', 'C']);
  });

  it(`draws the ${FLOW_TOP} largest flows as themselves and folds the rest into Other, keeping every amount`, () => {
    // 30 large flows from S0..S29 to R0..R29, then three small ones: from a drawn sender, to a drawn receiver, and between two names not drawn
    const big = Array.from({ length: FLOW_TOP }, (_, i) => row(`S${i}`, `R${i}`, 100 + i));
    const f = flowOf([...big, row('S0', 'X', 2), row('Y', 'R1', 3), row('Y2', 'X2', 1)], cols);
    expect(f.links.filter((l) => !l.folded)).toHaveLength(FLOW_TOP);
    const other = f.nodes.filter((n) => n.other);
    expect(other.map((n) => [n.depth, n.folded])).toEqual([
      [0, 2],
      [1, 2],
    ]);
    const folded = f.links.filter((l) => l.folded).map((l) => [f.nodes[l.source].other ? 'Other' : f.nodes[l.source].key, f.nodes[l.target].other ? 'Other' : f.nodes[l.target].key, l.value]);
    expect(folded).toEqual([
      ['Other', 'R1', 3],
      ['S0', 'Other', 2],
      ['Other', 'Other', 1],
    ]);
    expect(drawn(f)).toBe(f.total);
  });

  it('never draws a band backwards or past four columns, and keeps every amount, whatever the rows', () => {
    // a small seeded generator: the same 300 flows of 3 to 14 names every run
    let seed = 7;
    const rand = () => ((seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31);
    for (let k = 0; k < 300; k++) {
      const names = 3 + Math.floor(rand() * 12);
      const rows = Array.from({ length: 2 + Math.floor(rand() * 60) }, () => row(`N${Math.floor(rand() * names)}`, `N${Math.floor(rand() * names)}`, Math.round(rand() * 1000) / 10));
      const f = flowOf(rows, cols);
      expect(rightward(f)).toBe(true);
      expect(f.depth).toBeLessThanOrEqual(3);
      expect(drawn(f)).toBeCloseTo(f.total, 6);
    }
  });

  it('names a node from either column and keeps one node for an address in any case', () => {
    const a = (c: string) => `0x${c.repeat(40)}`;
    const names = { from_address: { [a('a')]: 'Aave' }, to_address: { [a('b')]: 'Benqi' } };
    const f = flowOf([row(a('A'), a('b'), 5), row(a('b'), a('c'), 4), row(a('a'), a('c'), 1)], { ...cols, names });
    expect(f.nodes.filter((n) => !n.copy).map((n) => [n.key, n.name])).toEqual([
      [a('a'), 'Aave'],
      [a('b'), 'Benqi'],
      [a('c'), undefined],
    ]);
  });
});
