import { describe, expect, it } from 'vitest';

import {
  changeOf,
  deltaOf,
  slugOf,
  toHistory,
  toLayers,
  toMeta,
  toPools,
  toProtocols,
  toVolume,
  type LiteProtocol,
} from '@/lib/defi/llama';
import {
  applyFilter,
  cutTo,
  facetCounts,
  PRESETS,
  presetActive,
  readState,
  sortRows,
  toCsv,
  toggleOption,
  writeState,
} from '@/lib/defi/protocol-filters';
import { groupOf } from '@/lib/defi/taxonomy';

/* Shaped like DefiLlama's lite payload for real Avalanche protocols, with
   rounded numbers so the layer arithmetic is easy to check. */
const lite: LiteProtocol[] = [
  {
    defillamaId: '1599',
    name: 'Aave V3',
    category: 'Lending',
    chains: ['Ethereum', 'Avalanche'],
    tvl: 1000,
    chainTvls: { Avalanche: { tvl: 300, tvlPrevDay: 290, tvlPrevWeek: 250, tvlPrevMonth: 200 }, 'Avalanche-borrowed': { tvl: 150 } },
    logo: 'https://icons.llamao.fi/icons/protocols/aave-v3?w=48&h=48',
    listedAt: 1648776877,
  },
  {
    defillamaId: '2',
    name: 'Benqi Staked Avax',
    category: 'Liquid Staking',
    chains: ['Avalanche'],
    tvl: 250,
    chainTvls: { Avalanche: { tvl: 250, tvlPrevWeek: 260 }, 'Avalanche-liquidstaking': { tvl: 250 } },
  },
  {
    defillamaId: '3',
    name: 'Grove Finance',
    category: 'Onchain Capital Allocator',
    chains: ['Avalanche'],
    tvl: 260,
    chainTvls: { Avalanche: { tvl: 260, tvlPrevWeek: 200 }, 'Avalanche-doublecounted': { tvl: 260 } },
  },
  { defillamaId: '4', name: 'OpenTrade', category: 'RWA', chains: ['Avalanche'], tvl: 170, chainTvls: { Avalanche: { tvl: 170 } } },
  { defillamaId: '5', name: 'CCIP', category: 'Bridge', chains: ['Ethereum', 'Avalanche'], tvl: 900, chainTvls: { Avalanche: { tvl: 80 } } },
  {
    defillamaId: '6',
    name: 'Pharaoh V3',
    category: 'Dexs',
    chains: ['Avalanche'],
    tvl: 25,
    chainTvls: { Avalanche: { tvl: 25, tvlPrevDay: 26, tvlPrevWeek: 20, tvlPrevMonth: 30 } },
    listedAt: Math.floor(Date.UTC(2026, 7, 1) / 1000),
  },
  { defillamaId: '7', name: 'Dead Farm', category: 'Farm', chains: ['Avalanche'], tvl: 0, chainTvls: { Avalanche: { tvl: 0 } } },
];

const dex = { total24h: 100, total7d: 700, total14dto7d: 500, total30d: 3000, total60dto30d: 3000, protocols: [{ defillamaId: '6', name: 'Pharaoh V3', total24h: 48, total7d: 300, total30d: 1000 }], totalDataChart: [[2, 20], [1, 10]] as [number, number][] };
const fees = { total24h: 5, protocols: [{ defillamaId: '1599', name: 'Aave V3', total24h: 2 }] };
const meta = toMeta([
  { id: '1599', slug: 'aave-v3', description: 'Earn interest', twitter: 'aave', address: 'avax:0x63A72806098Bd3D9520cC43356dD78afe5D386D9' },
  { id: '6', slug: 'pharaoh-v3', address: '0x1111111111111111111111111111111111111111' },
]);
const rows = toProtocols(lite, dex, fees, (slug) => (slug === 'pharaoh-v3' ? '0xrouter' : null), meta);

describe('taxonomy', () => {
  it('reads DefiLlama’s "Dexs" as a DEX, and anything unlisted as Other', () => {
    expect(groupOf('Dexs')).toBe('dex');
    expect(groupOf('Onchain Capital Allocator')).toBe('vaults');
    expect(groupOf('Liquid Staking')).toBe('lst');
    expect(groupOf('Something New')).toBe('other');
    expect(groupOf(null)).toBe('other');
  });
});

describe('toProtocols', () => {
  it('keeps protocols with Avalanche TVL, biggest first, with Avalanche-only numbers', () => {
    expect(rows.map((p) => p.name)).toEqual(['Aave V3', 'Grove Finance', 'Benqi Staked Avax', 'OpenTrade', 'CCIP', 'Pharaoh V3']);
    const aave = rows[0];
    expect(aave).toMatchObject({ tvl: 300, counted: 300, borrowed: 150, avalancheShare: 0.3, chains: 2, fees24h: 2, twitter: 'aave' });
    expect(changeOf(aave, '7d')).toBeCloseTo(20);
    expect(deltaOf(aave, '30d')).toBe(100);
  });

  it('counts nothing for vault redeposits, liquid staking, RWA and bridges', () => {
    const counted = Object.fromEntries(rows.map((p) => [p.name, p.counted]));
    expect(counted).toMatchObject({ 'Grove Finance': 0, 'Benqi Staked Avax': 0, OpenTrade: 0, CCIP: 0, 'Pharaoh V3': 25 });
  });

  it('joins volume and fees by DefiLlama id, and prefers the registry contract', () => {
    const pharaoh = rows.find((p) => p.name === 'Pharaoh V3')!;
    expect(pharaoh).toMatchObject({ volume24h: 48, volume7d: 300, volume30d: 1000, address: '0xrouter', slug: 'pharaoh-v3' });
    // DefiLlama's own address is used only when it is a C-Chain one
    expect(rows[0].address).toBe('0x63a72806098bd3d9520cc43356dd78afe5d386d9');
  });

  it('falls back to the icon URL, then the name, for the slug', () => {
    expect(slugOf({ logo: 'https://icons.llamao.fi/icons/protocols/aave-v3?w=48&h=48', name: 'Aave V3' })).toBe('aave-v3');
    expect(slugOf({ logo: null, name: 'Joe V2.2' })).toBe('joe-v2-2');
  });
});

describe('toLayers', () => {
  it('splits the value into disjoint layers that sum to the gross figure', () => {
    const l = toLayers(rows);
    expect(l).toMatchObject({ counted: 325, liquidStaking: 250, doubleCounted: 260, rwa: 170, bridges: 80, borrowed: 150, gross: 1085 });
    expect(l.counted + l.liquidStaking + l.doubleCounted + l.rwa + l.bridges).toBe(l.gross);
  });
});

describe('series', () => {
  it('builds the layer history from the chain chart, oldest first', () => {
    const h = toHistory({
      tvl: [['200', 1400], ['100', 1000]],
      doublecounted: [['100', 300], ['200', 500]],
      liquidstaking: [['100', 200], ['200', 250]],
      dcAndLsOverlap: [['200', 10]],
      borrowed: [['200', 270]],
    });
    expect(h).toEqual([
      { t: 100, counted: 500, liquidStaking: 200, doubleCounted: 300, borrowed: null },
      { t: 200, counted: 660, liquidStaking: 240, doubleCounted: 500, borrowed: 270 },
    ]);
  });

  it('takes the volume change from the window totals, and sorts the chart', () => {
    const v = toVolume(dex)!;
    expect(v.change7d).toBeCloseTo(40);
    expect(v.change30d).toBe(0);
    expect(v.chart).toEqual([[1, 10], [2, 20]]);
  });

  it('keeps Avalanche yield pools with TVL, biggest first', () => {
    const pools = toPools([
      { pool: 'a', chain: 'Avalanche', project: 'aave-v3', symbol: 'USDC', tvlUsd: 10, apy: 4, stablecoin: true, exposure: 'single', ilRisk: 'no' },
      { pool: 'b', chain: 'Ethereum', project: 'aave-v3', symbol: 'USDC', tvlUsd: 99 },
      { pool: 'c', chain: 'Avalanche', project: 'pharaoh-v3', symbol: 'WAVAX-USDC', tvlUsd: 20, apy: 40, ilRisk: 'yes' },
    ]);
    expect(pools.map((p) => p.id)).toEqual(['c', 'a']);
    expect(pools[1]).toMatchObject({ stablecoin: true, single: true, ilRisk: false });
  });
});

describe('protocol filters', () => {
  const now = Math.floor(Date.UTC(2026, 8, 25) / 1000);

  it('ORs options inside a facet and ANDs the facets', () => {
    const pick = applyFilter(rows, { group: ['lending', 'dex'], trend: ['up'] }, '', '7d', now);
    expect(pick.map((p) => p.name)).toEqual(['Aave V3', 'Pharaoh V3']);
    expect(applyFilter(rows, { group: ['lending', 'dex'], trend: ['up'] }, '', '30d', now).map((p) => p.name)).toEqual(['Aave V3']);
  });

  it('counts each option with the other facets applied, and sums its TVL', () => {
    const counts = facetCounts(rows, { trend: ['up'] }, '', '7d', now);
    expect(counts.group.lending).toEqual({ n: 1, tvl: 300 });
    expect(counts.group.lst).toEqual({ n: 0, tvl: 0 });
    expect(counts.trend.down).toEqual({ n: 0, tvl: 0 });
  });

  it('answers the presets', () => {
    const n = Object.fromEntries(PRESETS.map((p) => [p.id, applyFilter(rows, p.selection, '', '7d', now).length]));
    expect(n).toEqual({ growing: 3, shrinking: 0, natives: 4, new: 1, fees: 1 });
    expect(presetActive(PRESETS[0], { trend: ['up'] })).toBe(true);
  });

  it('searches names and categories', () => {
    expect(applyFilter(rows, {}, 'pharaoh', '7d', now).map((p) => p.name)).toEqual(['Pharaoh V3']);
    expect(applyFilter(rows, {}, 'liquid', '7d', now).map((p) => p.name)).toEqual(['Benqi Staked Avax']);
  });

  it('sorts by the window change with missing values last', () => {
    const by = sortRows(rows, { key: 'change', dir: -1 }, '7d').map((p) => p.name);
    expect(by.slice(0, 3)).toEqual(['Grove Finance', 'Pharaoh V3', 'Aave V3']);
    expect(by.slice(-2)).toEqual(['OpenTrade', 'CCIP']);
  });

  it('toggles and cuts facets', () => {
    expect(toggleOption({}, 'group', 'dex')).toEqual({ group: ['dex'] });
    expect(cutTo({ group: ['dex'] }, 'group', ['dex'])).toEqual({ group: undefined });
  });

  it('round-trips the URL and drops unknown options', () => {
    const s = { q: 'aave', selection: { group: ['lending', 'dex'], trend: ['up'] }, sort: { key: 'fees' as const, dir: 1 as const } };
    const params = writeState(new URLSearchParams('network=mainnet'), s);
    expect(params.get('network')).toBe('mainnet');
    expect(readState(params)).toEqual(s);
    expect(readState(new URLSearchParams('group=lending,nope&sort=bad')).selection).toEqual({ group: ['lending'] });
  });

  it('exports the rows with the window change', () => {
    const [head, first] = toCsv(rows.slice(0, 1), '7d').trim().split('\n');
    expect(head.split(',').slice(0, 6)).toEqual(['protocol', 'category', 'group', 'tvl_usd', 'change_7d_pct', 'change_7d_usd']);
    expect(first).toBe('Aave V3,Lending,Lending,300,20,50,,2,150,30,2022-04-01,https://defillama.com/protocol/aave-v3');
  });
});

describe('squarify', () => {
  it('tiles the whole frame, in proportion, without overlap past the edges', async () => {
    const { squarify } = await import('@/lib/defi/treemap');
    const values = [60, 25, 10, 5];
    const tiles = squarify(values.map((v, i) => ({ value: v, item: i })), 200, 100);
    const area = tiles.reduce((s, t) => s + t.w * t.h, 0);
    expect(area).toBeCloseTo(200 * 100);
    tiles.forEach((t) => {
      expect(t.w * t.h).toBeCloseTo((values[t.item] / 100) * 200 * 100);
      expect(t.x + t.w).toBeLessThanOrEqual(200 + 1e-9);
      expect(t.y + t.h).toBeLessThanOrEqual(100 + 1e-9);
    });
    expect(squarify([], 200, 100)).toEqual([]);
  });
});
