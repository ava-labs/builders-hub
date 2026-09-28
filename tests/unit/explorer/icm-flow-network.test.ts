import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CB58ToHex } from '@avalanche-sdk/client/utils';

/* The index holds Fuji's chains beside mainnet's, on both sides of a flow:
   the deliveries feed has Fuji receivers, the sends query Fuji senders. The
   audit saw the Fuji C-Chain (43113) to Dexalot's Fuji L1 (432201) on the
   mainnet city. Catalog blockchain IDs, in the index's uppercase hex. */
const hex = (id: string) => (id.startsWith('0x') ? id.slice(2) : CB58ToHex(id).slice(2)).toUpperCase();
const C_CHAIN = hex('2q9e4r6Mu3U68nU1fYjgbR6JvwrRx36CohpAX5UQxse55x1Q5');
const DEXALOT = hex('0x84bdd5b728daf315c23da60a4dc97e82da8027bfc64389f4b04ae1d3d91686b2');
const DEXALOT_FUJI = hex('0x4629d736bcd8c3a7bd7eef1c872365e9db32dc06eacf57fed72a94db5d934443');
const JONO122 = hex('0xc9e61ad36b830e9907447bd5088c40279c47a92d73ae8929a1f83a0aaf357a0c');

const sql: string[] = [];

vi.mock('@/lib/stats-api', () => ({
  statsApi: vi.fn(async () => ({
    flows: [
      { destChainId: 43114, sourceBlockchainHex: DEXALOT, messageCount: 50 },
      { destChainId: 43113, sourceBlockchainHex: JONO122, messageCount: 86 },
    ],
  })),
}));

vi.mock('@/lib/explorer-query/clickhouse', () => ({
  runQuery: vi.fn(async (q: string) => {
    sql.push(q);
    // both networks' senders, as the query read them before it was scoped
    return {
      rows: [
        { src: 43114, dest: DEXALOT, n: 40 },
        { src: 43113, dest: DEXALOT_FUJI, n: 1 },
      ],
    };
  }),
}));

const { getICMFlowData, getICMFlowDataBothSides } = await import('@/lib/icm-clickhouse');

const pairs = (flows: { sourceChainId: string; targetChainId: string; messageCount: number }[]) =>
  flows.map((f) => `${f.sourceChainId}>${f.targetChainId}:${f.messageCount}`).sort();

beforeEach(() => {
  sql.length = 0;
});

describe('getICMFlowDataBothSides', () => {
  it('keeps a Fuji flow off mainnet, from either side', async () => {
    const { flows, complete } = await getICMFlowDataBothSides(1, 'mainnet');
    expect(complete).toBe(true);
    expect(pairs(flows)).toEqual(['43114>432204:40', '432204>43114:50']);
  });

  it("gives Fuji its own flows, and none of mainnet's", async () => {
    const { flows } = await getICMFlowDataBothSides(1, 'fuji');
    expect(pairs(flows)).toEqual(['2XvEdm5FGHcFWAp6bGookz8BB9uo4mcVyfGf1LALogYkvMfYXd>43113:86', '43113>432201:1']);
  });

  it("reads only the network's own senders", async () => {
    await getICMFlowDataBothSides(1, 'mainnet');
    await getICMFlowDataBothSides(1, 'fuji');
    const ids = (q: string) => (/chain_id IN \(([^)]*)\)/.exec(q)?.[1] ?? '').split(', ');
    expect(ids(sql[0])).toContain('43114');
    expect(ids(sql[0])).not.toContain('43113');
    // KiteAI by the ID the index knows it by
    expect(ids(sql[0])).toContain('2366');
    expect(ids(sql[1])).toContain('43113');
    expect(ids(sql[1])).not.toContain('43114');
  });

  it('reads mainnet when no network is named', async () => {
    const { flows } = await getICMFlowDataBothSides(1);
    expect(flows.every((f) => f.sourceChainId !== '43113' && f.targetChainId !== '43113')).toBe(true);
  });
});

describe('getICMFlowData', () => {
  it('keeps the deliveries of each network apart', async () => {
    expect(pairs(await getICMFlowData(30, 'mainnet'))).toEqual(['432204>43114:50']);
    expect(pairs(await getICMFlowData(30, 'fuji'))).toEqual(['2XvEdm5FGHcFWAp6bGookz8BB9uo4mcVyfGf1LALogYkvMfYXd>43113:86']);
  });
});
