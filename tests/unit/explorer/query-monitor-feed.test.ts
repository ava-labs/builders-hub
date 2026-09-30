import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/explorer-query/enrich', () => ({ tokenList: vi.fn(async () => new Map()) }));

import { TRANSFER_TOPIC, type MonitorSpec } from '@/lib/explorer-query/monitor';
import { checkedSpec, eventsMonitor, eventsTitle, readMonitor, unitsOf } from '@/lib/explorer-query/monitor-feed';
import { MONITOR_EVENTS } from '@/lib/explorer-query/monitor-events';

/* A made-up chain state: the head is block 5000, one second a block. Addresses are made up. */
const USDT = '0x9702230a8ea53601f5cd2dc00fdbc13d4df4a8c7';
const A = '0x1111111111111111111111111111111111111111';
const B = '0x2222222222222222222222222222222222222222';
const HEAD = 5000;
const T0 = 1_790_000_000;
const pad = (a: string) => `0x${'0'.repeat(24)}${a.slice(2)}`;
const hex = (n: number | bigint) => `0x${n.toString(16)}`;
const log = (block: number, index: number, amount: bigint, extra: Record<string, unknown> = {}) => ({
  address: USDT,
  topics: [TRANSFER_TOPIC, pad(A), pad(B)],
  data: hex(amount),
  blockNumber: hex(block),
  transactionHash: `0x${String(block).padStart(4, '0')}${'ab'.repeat(30)}`,
  logIndex: hex(index),
  ...extra,
});
const LOGS = [
  log(4999, 3, 1_500_000n),
  log(5000, 1, 25_000_000_000n),
  // an ERC-721 Transfer: its token id is a fourth topic
  { ...log(5000, 2, 0n), topics: [TRANSFER_TOPIC, pad(A), pad(B), hex(7n)] },
  log(4998, 0, 9n, { removed: true }),
];
const block = (n: number, full = false) => ({
  number: hex(n),
  timestamp: hex(T0 + n),
  transactions: full
    ? [
        { hash: `0xa${n}`, from: A, to: B, value: hex(2n * 10n ** 18n), transactionIndex: '0x0' },
        { hash: `0xb${n}`, from: A, to: B, value: '0x0', transactionIndex: '0x1' },
        { hash: `0xc${n}`, from: B, to: null, value: hex(10n ** 18n), transactionIndex: '0x2' },
      ]
    : [],
});

type Req = { id: number; method: string; params: unknown[] };
const fetchMock = vi.fn(async (_url: string, init: { body: string }) => {
  const body = JSON.parse(init.body) as Req | Req[];
  const answer = (r: Req) => {
    if (r.method === 'eth_blockNumber') return { id: r.id, result: hex(HEAD) };
    if (r.method === 'eth_getLogs') {
      const f = r.params[0] as { fromBlock: string; toBlock: string };
      return { id: r.id, result: LOGS.filter((l) => parseInt(l.blockNumber, 16) >= parseInt(f.fromBlock, 16) && parseInt(l.blockNumber, 16) <= parseInt(f.toBlock, 16)) };
    }
    if (r.method === 'eth_getBlockByNumber') return { id: r.id, result: block(parseInt(r.params[0] as string, 16), r.params[1] as boolean) };
    return { id: r.id, error: { message: 'no such method' } };
  };
  return new Response(JSON.stringify(Array.isArray(body) ? body.map(answer) : answer(body)));
});

const spec = (over: Partial<MonitorSpec> = {}): MonitorSpec => ({ chainId: 43114, kind: 'transfers', title: 'USDT transfers', token: { address: USDT, symbol: 'USDT', decimals: 6 }, ...over });
const calls = (method: string) =>
  fetchMock.mock.calls.flatMap((c) => {
    const b = JSON.parse((c[1] as { body: string }).body) as Req | Req[];
    return (Array.isArray(b) ? b : [b]).filter((r) => r.method === method);
  }).length;

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock);
  fetchMock.mockClear();
});

describe('readMonitor', () => {
  it('opens on the last few minutes: ERC-20 moves only, newest first, at their block times', async () => {
    const read = await readMonitor(spec({ title: 'a' }), null);
    expect(read).toMatchObject({ head: HEAD, headAt: (T0 + HEAD) * 1000, from: HEAD - 499, fromAt: (T0 + HEAD - 499) * 1000, gap: false });
    expect(read.items.map((i) => [i.block, i.amount, i.at])).toEqual([
      [5000, 25_000, (T0 + 5000) * 1000],
      [4999, 1.5, (T0 + 4999) * 1000],
    ]);
    expect(read.items[0]).toMatchObject({ from: A, to: B, index: 1 });
  });

  it('keeps only moves of the smallest amount, and reads on from the block it is given', async () => {
    const read = await readMonitor(spec({ title: 'b', minAmount: 100 }), 5000);
    expect(read.from).toBe(5000);
    expect(read.items.map((i) => i.amount)).toEqual([25_000]);
  });

  it('starts again at the head after a gap longer than one read covers', async () => {
    const read = await readMonitor(spec({ title: 'c', minAmount: 1 }), 1);
    expect(read).toMatchObject({ from: HEAD - 499, gap: true });
  });

  it('shares one read between readers of the same monitor', async () => {
    const s = spec({ involving: A });
    await Promise.all([readMonitor(s, 4990), readMonitor({ ...s, title: 'another name' }, 4990)]);
    expect(calls('eth_blockNumber')).toBe(1);
    // an address both ways is two log filters
    expect(calls('eth_getLogs')).toBe(2);
  });

  it('reads a coin from the value its transactions carry', async () => {
    const read = await readMonitor({ chainId: 43114, kind: 'native', coin: 'AVAX', title: 'AVAX transfers' }, 4999);
    expect(read.items.map((i) => [i.tx, i.amount])).toEqual([
      ['0xa5000', 2],
      ['0xa4999', 2],
    ]);
  });
});

describe('checkedSpec', () => {
  it('holds a spec from the page to what a monitor may read', () => {
    expect(checkedSpec(spec())).toEqual(spec());
    // every token on the whole chain is too much to read
    expect(checkedSpec({ chainId: 43114, kind: 'transfers', title: 'x' })).toBeNull();
    expect(checkedSpec({ ...spec(), from: 'not an address' })).toBeNull();
    expect(checkedSpec({ ...spec(), token: { address: USDT, symbol: 'USDT', decimals: 99 } })).toBeNull();
    // the P-Chain has no logs, and a chain with no RPC cannot be read
    expect(checkedSpec({ ...spec(), chainId: 1 })).toBeNull();
    expect(checkedSpec({ ...spec(), chainId: 999999999 })).toBeNull();
  });

  it('scales a raw amount to whole units, to six places', () => {
    expect(unitsOf(25_000_000_000n, 6)).toBe(25_000);
    expect(unitsOf(1_234_567_891_234_567_891n, 18)).toBe(1.234567);
  });
});

describe('an events monitor', () => {
  const USDC = '0xb97ef9ef8734c71904d8002f8b6bc66dd9c48a6e';
  const TOKENS = new Map([
    [USDC, { symbol: 'USDC', name: 'USD Coin', decimals: 6 }],
    ['0x2b2c81e08f1af8835a78bb2a90ae924ace0ea4be', { symbol: 'sAVAX', name: 'Staked AVAX', decimals: 18 }],
  ]);
  const key = (k: string) => MONITOR_EVENTS.find((d) => d.key === k)!;
  const AAVE = key('aave-v3/liquidation');
  const V3 = key('uniswap/univ3-swap');
  const SOLIDLY = MONITOR_EVENTS.find((d) => d.poolCheck && 'onFactory' in d.poolCheck)!;
  const [P1, P2, P3] = ['0x3333333333333333333333333333333333333333', '0x4444444444444444444444444444444444444444', '0x5555555555555555555555555555555555555555'];
  const word = (n: bigint | string) => (typeof n === 'string' ? n.slice(2).padStart(64, '0') : n.toString(16).padStart(64, '0'));
  const at = (block: number, index: number, address: string, topics: string[], words: (bigint | string)[]) => ({
    address,
    topics,
    data: `0x${words.map(word).join('')}`,
    blockNumber: hex(block),
    transactionHash: `0x${String(block).padStart(4, '0')}${String(index).padStart(2, '0')}${'cd'.repeat(29)}`,
    logIndex: hex(index),
  });
  const EVENT_LOGS = [
    // an Aave liquidation: 1,000 USDC of A's debt covered by B
    at(4990, 1, AAVE.addresses![0], [AAVE.topic0, pad('0xb31f66aa3c1e785363f0875a1b74e27b85fd66c7'), pad(USDC), pad(A)], [1_000_000_000n, 5n * 10n ** 17n, B, 0n]),
    // a univ3 swap in a Uniswap v3 pool, for recipient A; its amounts are the pool's two tokens
    at(4995, 2, P1, [V3.topic0, pad(B), pad(A)], [5n, 2n ** 256n - 7n, 1n, 1n, 1n]),
    // a v2-shaped swap in a Solidly pair, which no getter names, and one in a pool of no known factory
    at(4996, 0, P2, [SOLIDLY.topic0, pad(B), pad(A)], [1n, 0n, 0n, 2n]),
    at(4997, 0, P3, [SOLIDLY.topic0, pad(B), pad(A)], [1n, 0n, 0n, 2n]),
  ];
  const eventsFetch = vi.fn(async (_url: string, init: { body: string }) => {
    const body = JSON.parse(init.body) as Req | Req[];
    const answer = (r: Req) => {
      if (r.method === 'eth_blockNumber') return { id: r.id, result: hex(HEAD) };
      if (r.method === 'eth_getLogs') {
        const f = r.params[0] as { fromBlock: string; toBlock: string; topics: string[]; address?: string[] };
        const found = EVENT_LOGS.filter(
          (l) => l.topics[0] === f.topics[0] && (!f.address || f.address.includes(l.address)) && parseInt(l.blockNumber, 16) >= parseInt(f.fromBlock, 16) && parseInt(l.blockNumber, 16) <= parseInt(f.toBlock, 16),
        );
        return { id: r.id, result: found };
      }
      if (r.method === 'eth_getBlockByNumber') return { id: r.id, result: block(parseInt(r.params[0] as string, 16)) };
      if (r.method === 'eth_call') {
        const { to, data } = r.params[0] as { to: string; data: string };
        if (to === P1 && data === '0xc45a0155') return { id: r.id, result: pad(V3.factories![0]) };
        if (SOLIDLY.factories!.includes(to) && data.startsWith('0xe5e31b13')) return { id: r.id, result: `0x${word(data.endsWith(P2.slice(2)) ? 1n : 0n)}` };
        return { id: r.id, error: { message: 'execution reverted' } };
      }
      return { id: r.id, error: { message: 'no such method' } };
    };
    return new Response(JSON.stringify(Array.isArray(body) ? body.map(answer) : answer(body)));
  });
  const evSpec = (over: Partial<MonitorSpec> = {}): MonitorSpec => ({ chainId: 43114, kind: 'events', title: 'e', events: [AAVE.key, V3.key, SOLIDLY.key], ...over });
  const asked = (method: string) =>
    eventsFetch.mock.calls.flatMap((c) => {
      const b = JSON.parse((c[1] as { body: string }).body) as Req | Req[];
      return (Array.isArray(b) ? b : [b]).filter((r) => r.method === method);
    }).length;

  beforeEach(() => {
    vi.stubGlobal('fetch', eventsFetch);
    eventsFetch.mockClear();
  });

  it('reads the words as catalog events, and leaves one token\'s transfers to the transfers monitor', () => {
    expect(eventsMonitor('monitor aave liquidations', 43114, TOKENS)).toMatchObject({ kind: 'events', events: ['aave-v3/liquidation'], title: 'Aave v3 liquidations' });
    expect(eventsMonitor('real-time liquidations', 43114, TOKENS)).toMatchObject({ events: ['aave-v3/liquidation', 'benqi/liquidation'], title: 'Liquidations on Aave v3 and Benqi' });
    expect(eventsMonitor('track benqi borrows', 43114, TOKENS)?.events).toEqual(['benqi/borrow']);
    const pharaoh = eventsMonitor('watch pharaoh swaps', 43114, TOKENS)!;
    expect(pharaoh.title).toBe('Pharaoh swaps');
    expect(pharaoh.events!.length).toBeGreaterThan(1);
    expect(pharaoh.events!.every((k) => k.startsWith('pharaoh/'))).toBe(true);
    // a token named beside events of any token keeps its rows; one the events are named for does not
    expect(eventsMonitor('monitor usdc supplies on aave', 43114, TOKENS)).toMatchObject({ events: ['aave-v3/supply'], token: { address: USDC }, unit: 'USDC', title: 'Aave v3 supplies in USDC' });
    expect(eventsMonitor('live savax staking', 43114, TOKENS)).toMatchObject({ title: 'Benqi sAVAX activity' });
    expect(eventsMonitor('live savax staking', 43114, TOKENS)!.token).toBeUndefined();
    expect(eventsMonitor('monitor savax stakes over 100', 43114, TOKENS)).toMatchObject({ events: ['benqi/savax-stake'], unit: 'AVAX', minAmount: 100 });
    for (const words of ['monitor usdc transfers', 'monitor usdt', 'live validators', 'aave liquidations today']) expect(eventsMonitor(words, 43114, TOKENS)).toBeNull();
    expect(eventsMonitor('monitor aave liquidations', 432204, TOKENS)).toBeNull();
    expect(eventsTitle([AAVE, key('benqi/liquidation'), key('aave-v3/supply')], 'liquidations')).toBe('Liquidations on Aave v3 and Benqi');
  });

  it('holds a spec the page sends back to known events, each once, on the C-Chain', () => {
    expect(checkedSpec(evSpec())).toMatchObject({ kind: 'events', events: [AAVE.key, V3.key, SOLIDLY.key] });
    expect(checkedSpec(evSpec({ unit: 'USDC' }))?.unit).toBe('USDC');
    for (const bad of [{ events: [] }, { events: ['no/such-event'] }, { events: [AAVE.key, AAVE.key] }, { chainId: 432204 }, { events: MONITOR_EVENTS.slice(0, 25).map((d) => d.key) }])
      expect(checkedSpec(evSpec(bad as Partial<MonitorSpec>))).toBeNull();
  });

  it("names each log's event by its pool's factory, asked once a pool, and drops a pool of none", async () => {
    const read = await readMonitor(evSpec(), null, TOKENS);
    // rows name their event in the singular, with its protocol, as the monitor reads three
    const one = (label: string) => label.replace(/s$/, '');
    expect(read.items.map((i) => [i.block, i.event, i.from, i.to, i.amount, i.symbol ?? null])).toEqual([
      [4996, one(SOLIDLY.label), A, P2, null, null],
      [4995, one(V3.label), A, P1, null, null],
      [4990, 'Aave v3 liquidation', A, AAVE.addresses![0], 1000, 'USDC'],
    ]);
    const calls = asked('eth_call');
    // factory() of P1 only (no event of the spec is a univ2 pool's); isPair of P2 and P3 on each Solidly factory
    expect(calls).toBe(1 + 2 * SOLIDLY.factories!.length);
    // a later read asks no pool again
    await readMonitor(evSpec(), 4990, TOKENS);
    expect(asked('eth_call')).toBe(calls);
  });

  it('keeps the rows of the named token, or of the named account', async () => {
    const usdc = await readMonitor(evSpec({ events: [AAVE.key], token: { address: USDC, symbol: 'USDC', decimals: 6 } }), null, TOKENS);
    expect(usdc.items).toHaveLength(1);
    // one protocol's rows leave its name to the title
    expect(usdc.items[0].event).toBe('Liquidation');
    const unlock = MONITOR_EVENTS.find((d) => d.key === 'benqi/savax-unlock')!;
    expect(eventsMonitor('live savax staking', 43114, TOKENS)!.events).toContain(unlock.key);
    const none = await readMonitor(evSpec({ events: [AAVE.key], from: B }), null, TOKENS);
    expect(none.items).toHaveLength(0);
  });
});
