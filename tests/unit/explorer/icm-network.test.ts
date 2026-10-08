import { describe, expect, it, vi } from 'vitest';
import l1ChainsData from '@/constants/l1-chains.json';

/* The ICM day series of a scope. The index holds Fuji's chains beside
   mainnet's: "all" is mainnet only and keeps the IDs the catalog does not
   know (they are mainnet chains), "fuji" is the catalog's Fuji chains only,
   and any other ID is that chain alone. 43114 is the mainnet C-Chain, 43113
   the Fuji C-Chain, 432201 Dexalot's Fuji L1. */
const UNKNOWN = 990001;

const days = [
  { chainId: 43114, day: '2026-10-01', incoming: 100, outgoing: 90 },
  { chainId: 43113, day: '2026-10-01', incoming: 40, outgoing: 30 },
  { chainId: 432201, day: '2026-10-01', incoming: 2, outgoing: 3 },
  { chainId: UNKNOWN, day: '2026-10-01', incoming: 5, outgoing: 0 },
  { chainId: 43114, day: '2026-10-02', incoming: 7, outgoing: 1 },
  // sends with no delivery: a day with no delivery is left out
  { chainId: 432201, day: '2026-10-03', incoming: 0, outgoing: 4 },
  { chainId: 43113, day: '2025-01-01', incoming: 9, outgoing: 9 },
];

vi.mock('@/lib/stats-api', () => ({ statsApi: vi.fn(async () => ({ days })) }));

const { icmDaysOf, getChainICMData, getChainICMCount } = await import('@/lib/icm-clickhouse');

const incoming = days.filter((d) => d.incoming > 0).map((d) => ({ chain_id: d.chainId, day: d.day, incoming_count: d.incoming }));
const outgoing = days.filter((d) => d.outgoing > 0).map((d) => ({ chain_id: d.chainId, day: d.day, outgoing_count: d.outgoing }));
const sec = (day: string) => Date.parse(`${day}T00:00:00Z`) / 1000;
const short = (points: { date: string; messageCount: number; outgoingCount: number }[]) =>
  points.map((p) => `${p.date}:${p.messageCount}/${p.outgoingCount}`);

describe('icmDaysOf', () => {
  it('reads the catalog the way the test assumes', () => {
    const byId = new Map(l1ChainsData.map((c) => [String(c.chainId), c as { isTestnet?: boolean }]));
    expect(byId.get('43114')?.isTestnet).not.toBe(true);
    expect(byId.get('43113')?.isTestnet).toBe(true);
    expect(byId.get('432201')?.isTestnet).toBe(true);
    expect(byId.has(String(UNKNOWN))).toBe(false);
  });

  it('counts mainnet for "all": no Fuji chain, and the chains the catalog does not know', () => {
    expect(short(icmDaysOf(incoming, outgoing, 'all', sec('2026-01-01')))).toEqual(['2026-10-02:7/1', '2026-10-01:105/90']);
  });

  it('counts the catalog Fuji chains for "fuji", and nothing of mainnet', () => {
    expect(short(icmDaysOf(incoming, outgoing, 'fuji', sec('2026-01-01')))).toEqual(['2026-10-01:42/33']);
  });

  it('counts one chain alone for its ID', () => {
    expect(short(icmDaysOf(incoming, outgoing, '43114', 0))).toEqual(['2026-10-02:7/1', '2026-10-01:100/90']);
    expect(short(icmDaysOf(incoming, outgoing, '43113', 0))).toEqual(['2026-10-01:40/30', '2025-01-01:9/9']);
    expect(icmDaysOf(incoming, outgoing, 'not-a-chain', 0)).toEqual([]);
  });

  it('leaves out the days before the cutoff and the days with no delivery', () => {
    expect(short(icmDaysOf(incoming, outgoing, 'fuji', 0))).toEqual(['2026-10-01:42/33', '2025-01-01:9/9']);
    expect(short(icmDaysOf(incoming, outgoing, '432201', 0))).toEqual(['2026-10-01:2/3']);
  });

  it('gives each point its day start in seconds and counts deliveries as messages', () => {
    const [p] = icmDaysOf(incoming, outgoing, '432201', 0);
    expect(p).toEqual({ timestamp: sec('2026-10-01'), date: '2026-10-01', messageCount: 2, incomingCount: 2, outgoingCount: 3 });
  });
});

describe('getChainICMData', () => {
  it('splits the stats API days by network', async () => {
    vi.useFakeTimers({ now: Date.parse('2026-10-05T12:00:00Z') });
    try {
      expect(short(await getChainICMData('all', 30))).toEqual(['2026-10-02:7/1', '2026-10-01:105/90']);
      expect(short(await getChainICMData('fuji', 30))).toEqual(['2026-10-01:42/33']);
      expect(await getChainICMCount('fuji', 7)).toBe(42);
      expect(await getChainICMCount('all', 7)).toBe(112);
    } finally {
      vi.useRealTimers();
    }
  });
});
