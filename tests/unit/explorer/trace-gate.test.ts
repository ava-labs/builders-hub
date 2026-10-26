import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { rateBucket } from '@/lib/net/clientIp';
import { RedisFake } from './redis-fake';

/* The node budget for the shared C-Chain debug node (lib/trace-gate.ts).
   One RedisFake stands for the Redis that all Vercel instances share. Only
   Date is faked, so leases and windows move while the gate's own Redis
   timeout still runs on real timers. IPs are from the documentation ranges. */

const fake = { client: null as RedisFake | null };
vi.mock('@/lib/redis', () => ({ redis: async () => fake.client }));

const gate = await import('@/lib/trace-gate');
const { enterGate, SLOTS, OPEN_SLOTS, PER_MINUTE, OPEN_PER_MINUTE, IP_PER_MINUTE, IP_PER_HOUR, LEASE_MS, BREAKER_ERRORS, BREAKER_MS } = gate;

type Lane = 'open' | 'gesture' | 'chat';
let ipN = 0;
/** a new client IP each call, so the per-IP limit stays out of the way */
const ip = () => `203.0.${Math.floor(ipN / 250) % 250}.${ipN++ % 250}`;
const pass = async (lane: Lane, from = ip(), chain = '43114') => {
  const g = await enterGate(chain, lane, from);
  if (!('pass' in g)) throw new Error(`refused: ${g.refused}`);
  return g.pass;
};
const refusal = async (lane: Lane, from = ip(), chain = '43114') => {
  const g = await enterGate(chain, lane, from);
  return 'refused' in g ? g.refused : 'passed';
};
/** one trace start to end, so slots stay free and only the budgets count */
const trace = async (lane: Lane, from = ip(), chain = '43114') => (await pass(lane, from, chain)).done('answered');

beforeEach(() => {
  fake.client = new RedisFake();
  vi.stubEnv('REDIS_URL', 'redis://redis.invalid:6379');
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-10-23T21:00:05Z'));
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
});

describe('slots', () => {
  it(`lets ${SLOTS} traces on one chain's node at once, then refuses as busy`, async () => {
    for (let i = 0; i < SLOTS; i++) await pass('gesture');
    expect(await refusal('gesture')).toBe('busy');
    expect(await refusal('chat')).toBe('busy');
    // the other chain's node is another node
    await pass('gesture', ip(), '43113');
  });

  it(`gives page loads with no gesture ${OPEN_SLOTS} of the slots, and the other lanes the top ones first`, async () => {
    for (let i = 0; i < SLOTS - OPEN_SLOTS; i++) await pass('gesture');
    for (let i = 0; i < OPEN_SLOTS; i++) await pass('open');
    expect(await refusal('open')).toBe('busy');
    expect(await refusal('gesture')).toBe('busy');
  });

  it('frees a slot when the node answers or fails, but not when our fetch gave up', async () => {
    const held = [];
    for (let i = 0; i < SLOTS; i++) held.push(await pass('gesture'));
    await held[0].done('answered');
    await held[1].done('node_error');
    await held[2].done('abandoned');
    await pass('gesture');
    await pass('gesture');
    // the abandoned trace may still run on the node: its slot waits for the lease
    expect(await refusal('gesture')).toBe('busy');
    vi.setSystemTime(Date.now() + LEASE_MS);
    await pass('gesture');
  });

  it('never frees a slot that a later trace holds after the lease ran out', async () => {
    const first = [];
    for (let i = 0; i < SLOTS; i++) first.push(await pass('gesture'));
    vi.setSystemTime(Date.now() + LEASE_MS + 1);
    for (let i = 0; i < SLOTS; i++) await pass('gesture');
    for (const p of first) await p.done('answered');
    expect(await refusal('gesture')).toBe('busy');
  });

  it('frees a slot whose SET landed after the gate stopped waiting', async () => {
    vi.useRealTimers();
    fake.client!.delayMs = 400;
    expect(await refusal('gesture')).toBe('unavailable');
    await new Promise((r) => setTimeout(r, 1_000));
    expect([...fake.client!.store.keys()].filter((k) => k.includes(':slot:'))).toEqual([]);
  });
});

describe('budgets', () => {
  it(`allows ${PER_MINUTE} new traces a minute per chain, ${OPEN_PER_MINUTE} of them from page loads with no gesture`, async () => {
    for (let i = 0; i < OPEN_PER_MINUTE; i++) await trace('open');
    expect(await refusal('open')).toBe('rate');
    for (let i = OPEN_PER_MINUTE; i < PER_MINUTE; i++) await trace('gesture');
    expect(await refusal('gesture')).toBe('rate');
    expect(await refusal('chat')).toBe('rate');
    await trace('gesture', ip(), '43113');
    vi.setSystemTime(Date.now() + 60_000);
    await trace('open');
  });

  it('spends no budget on a refusal, so a burst of busy answers does not close the minute', async () => {
    const one = '198.51.100.20';
    const held = [];
    for (let i = 0; i < SLOTS; i++) held.push(await pass('gesture'));
    for (let i = 0; i < 3 * PER_MINUTE; i++) expect(await refusal('gesture', one)).toBe('busy');
    for (const p of held) await p.done('answered');
    await trace('gesture', one);
  });

  it(`allows one IP ${IP_PER_MINUTE.open} new traces a minute on page loads and ${IP_PER_MINUTE.gesture} after a gesture`, async () => {
    const one = '198.51.100.7';
    for (let i = 0; i < IP_PER_MINUTE.open; i++) await trace('open', one);
    expect(await refusal('open', one)).toBe('rate');
    for (let i = IP_PER_MINUTE.open; i < IP_PER_MINUTE.gesture; i++) await trace('gesture', one);
    expect(await refusal('gesture', one)).toBe('rate');
    // other people, and the chat, which has no client IP, still pass
    await trace('gesture');
    await trace('chat', one);
  });

  it(`allows one IP ${IP_PER_HOUR.gesture} new traces an hour`, async () => {
    const one = '198.51.100.8';
    for (let i = 0; i < IP_PER_HOUR.gesture; i++) {
      if (i % IP_PER_MINUTE.gesture === 0) vi.setSystemTime(new Date('2026-10-23T21:00:05Z').getTime() + (i / IP_PER_MINUTE.gesture) * 60_000);
      await trace('gesture', one);
    }
    vi.setSystemTime(new Date('2026-10-23T21:59:05Z'));
    expect(await refusal('gesture', one)).toBe('rate');
  });

  it('counts an IPv6 host by its /64, so new addresses in it do not reset the count', async () => {
    for (let i = 0; i < IP_PER_MINUTE.open; i++) await trace('open', `2001:db8:1:2::${(i + 1).toString(16)}`);
    expect(await refusal('open', '2001:db8:1:2:ffff:ffff:ffff:ffff')).toBe('rate');
    await trace('open', '2001:db8:1:3::1');
  });

  it(`stops a chain's traces for a minute after ${BREAKER_ERRORS} node failures`, async () => {
    for (let i = 0; i < BREAKER_ERRORS; i++) await (await pass('gesture')).done('node_error');
    expect(await refusal('gesture')).toBe('breaker');
    expect(await refusal('chat')).toBe('breaker');
    await trace('gesture', ip(), '43113');
    vi.setSystemTime(Date.now() + BREAKER_MS);
    await pass('gesture');
  });
});

describe('without Redis', () => {
  it('refuses when Redis is down or slow', async () => {
    fake.client!.down = true;
    expect(await refusal('gesture')).toBe('unavailable');
    fake.client!.down = false;
    fake.client!.delayMs = 400;
    vi.useRealTimers();
    expect(await refusal('chat')).toBe('unavailable');
  });

  it('refuses on Vercel when REDIS_URL is not set', async () => {
    fake.client = null;
    vi.stubEnv('REDIS_URL', '');
    vi.stubEnv('VERCEL', '1');
    expect(await refusal('gesture')).toBe('unavailable');
  });

  it(`keeps ${SLOTS} slots and ${PER_MINUTE} a minute in memory on a local dev server with no Redis`, async () => {
    fake.client = null;
    vi.stubEnv('REDIS_URL', '');
    vi.stubEnv('VERCEL', '');
    vi.setSystemTime(new Date('2026-10-23T21:30:05Z'));
    const held = [];
    for (let i = 0; i < SLOTS; i++) held.push(await pass('open'));
    expect(await refusal('open')).toBe('busy');
    await held[0].done('answered');
    await held[0].done('answered');
    await pass('open');
    expect(await refusal('open')).toBe('busy');
  });
});

describe('rateBucket', () => {
  it('keeps an IPv4 address and cuts an IPv6 address to its /64', () => {
    expect(rateBucket('203.0.113.9')).toBe('203.0.113.9');
    expect(rateBucket('2001:db8:1:2::abcd')).toBe('2001:db8:1:2::/64');
    expect(rateBucket('2001:0db8:0001:0002:aaaa:bbbb:cccc:dddd')).toBe('2001:db8:1:2::/64');
    expect(rateBucket('2001:db8::1')).toBe('2001:db8:0:0::/64');
    expect(rateBucket('::1')).toBe('0:0:0:0::/64');
  });
});
