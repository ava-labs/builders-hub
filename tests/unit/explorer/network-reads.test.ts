import { describe, expect, it } from 'vitest';

import {
  blocksFeed,
  boardReads,
  networkSeriesUrl,
  overviewStatsUrl,
  priceHistoryUrl,
  rosterOf,
} from '@/components/explorer-v2/network/network-reads';
import { catalogOf } from '@/lib/explorer-catalog';

const row = (chainId: string, txCount: number | null, chainLogoURI = '') => ({ chainId, chainName: `Chain ${chainId}`, chainLogoURI, txCount });

describe('the overview boards roster', () => {
  it('takes the busiest chains an RPC reads, eight at most', () => {
    const rows = [
      row('4337', 50),
      row('43114', 900),
      // no RPC, a testnet, a chain the catalog does not know
      row('LEJHppkiGCMMrTyH8y6CGSuWaB6g3ZN6TVqJ9WUrTwwUNiz6N', 2000),
      row('2201', 1500),
      row('999999', 1200),
      row('46975', null),
      row('432204', 40),
      row('202110', 30),
      row('43419', 20),
      row('7272', 10),
      row('28530', 5),
      row('737373', 1),
    ];
    expect(rosterOf(rows).map((c) => c.chainId)).toEqual(['43114', '4337', '432204', '202110', '43419', '7272', '28530', '737373']);
  });

  it("wears the feed's name and logo, else the catalog's logo", () => {
    const [c] = rosterOf([row('43114', 1)]);
    expect(c).toMatchObject({ chainId: '43114', slug: 'c-chain', name: 'Chain 43114', symbol: 'AVAX' });
    expect(c.logo).not.toBe('');
    expect(rosterOf([row('43114', 1, 'https://example.com/logo.png')])[0].logo).toBe('https://example.com/logo.png');
  });

  it('names the one read each chain opens both boards with', () => {
    expect(boardReads([row('4337', 1), row('43114', 2)])).toEqual([
      '/api/explorer/43114?blocksOnly=true&txs=3',
      '/api/explorer/4337?blocksOnly=true&txs=3',
    ]);
    expect(blocksFeed('43114', 96_000_000)).toBe('/api/explorer/43114?blocksOnly=true&txs=3&lastFetchedBlock=96000000');
  });

  it("reads a Fuji roster from Fuji's catalog: its chains stay and mainnet's drop", () => {
    const rows = [row('43114', 900), row('43113', 800), row('4337', 700), row('13337', 600), row('432204', 500), row('432201', 400)];
    const fuji = rosterOf(rows, 'fuji');
    expect(fuji.map((c) => c.chainId)).toEqual(['43113', '13337', '432201']);
    expect(fuji[0]).toMatchObject({ slug: 'c-chain', symbol: 'AVAX' });
    expect(boardReads(rows, 'fuji')).toEqual(fuji.map((c) => blocksFeed(c.chainId)));
    // mainnet keeps its own chains and drops Fuji's
    expect(rosterOf(rows).map((c) => c.chainId)).toEqual(['43114', '4337', '432204']);
  });

  it('never fills a Fuji slot with a chain that has no transactions', () => {
    // every Fuji chain an RPC reads, most with no count, as the Fuji overview feed gives them
    const counts: Record<string, number> = { '43113': 800, '13337': 0, '432201': 12 };
    const rows = [...catalogOf('fuji').values()].filter((c) => c.rpcUrl).map((c) => row(c.chainId, counts[c.chainId] ?? null));
    expect(rows.length).toBeGreaterThan(8);
    const fuji = rosterOf(rows, 'fuji');
    expect(fuji.map((c) => c.chainId)).toEqual(['43113', '432201']);
    const txCountOf = new Map(rows.map((r) => [r.chainId, r.txCount]));
    expect(fuji.every((c) => (txCountOf.get(c.chainId) ?? 0) > 0)).toBe(true);
  });

  it('keeps one catalog map per network', () => {
    expect([...catalogOf('fuji').values()].every((c) => c.isTestnet === true)).toBe(true);
    expect([...catalogOf().values()].some((c) => c.isTestnet === true)).toBe(false);
    expect(catalogOf('mainnet')).toBe(catalogOf());
  });
});

describe("the network pages' windows", () => {
  it('clamps the overview to a year and reads two of its windows of history', () => {
    expect(overviewStatsUrl('all')).toBe('/api/overview-stats?timeRange=year');
    expect(overviewStatsUrl('week')).toBe('/api/overview-stats?timeRange=week');
    expect(networkSeriesUrl(7)).toMatch(/timeRange=30d$/);
    expect(networkSeriesUrl(30)).toMatch(/timeRange=90d$/);
    expect(networkSeriesUrl(365)).toMatch(/timeRange=all$/);
  });

  it("names no network on mainnet and adds Fuji's", () => {
    expect(overviewStatsUrl('month', 'mainnet')).toBe('/api/overview-stats?timeRange=month');
    expect(overviewStatsUrl('all', 'fuji')).toBe('/api/overview-stats?timeRange=year&network=fuji');
    expect(networkSeriesUrl(7)).toBe('/api/chain-stats/all?metrics=txCount,activeAddresses,icmMessages&timeRange=30d');
    expect(networkSeriesUrl(7, 'fuji')).toBe('/api/chain-stats/fuji?metrics=txCount,activeAddresses,icmMessages&timeRange=30d');
  });

  it("reads the price on the clock's window: hourly for a day, a year at most", () => {
    expect(priceHistoryUrl(1)).toBe('/api/market-history/43114?days=1');
    expect(priceHistoryUrl(90)).toBe('/api/market-history/43114?days=90');
    expect(priceHistoryUrl(3650)).toBe('/api/market-history/43114?days=365');
  });
});
