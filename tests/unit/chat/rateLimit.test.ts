import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/* The chat limiter has to hold across instances: on serverless every cold
   start hands back the full allowance, so a per-instance Map lets a caller
   spend `limit` messages per instance instead of per hour. These tests model
   instances as separate module registries over one shared Redis. */

type Counter = { count: number; expiresAt: number };

/** The INCR / PEXPIRE-on-first / PTTL sequence of RATE_LIMIT_SCRIPT, by hand:
    eval() is the only Redis call the limiter makes. */
const store = new Map<string, Counter>();
const redisUp = { on: true, throws: false };
const evals: string[] = [];

vi.mock('@/lib/redis', () => ({
  redis: vi.fn(async () => {
    if (!redisUp.on) return null;
    return {
      eval: async (_script: string, opts: { keys: string[]; arguments: string[] }) => {
        if (redisUp.throws) throw new Error('Connection is closed.');
        const key = opts.keys[0];
        const windowMs = Number(opts.arguments[0]);
        evals.push(key);
        const now = Date.now();
        const live = store.get(key);
        if (!live || live.expiresAt <= now) {
          store.set(key, { count: 1, expiresAt: now + windowMs });
          return [1, windowMs];
        }
        live.count += 1;
        return [live.count, live.expiresAt - now];
      },
    };
  }),
}));

/** A fresh module registry: the limiter's in-memory Map starts empty, exactly
    as it does in a new serverless instance. Redis `store` is deliberately not
    reset, since that is the state the instances share. */
const newInstance = async () => {
  vi.resetModules();
  return import('@/lib/chat/rateLimit');
};

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-10-05T12:00:00Z'));
  store.clear();
  evals.length = 0;
  redisUp.on = true;
  redisUp.throws = false;
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
});

describe('checkChatRateLimit', () => {
  it('spends one allowance across instances instead of one per instance', async () => {
    const first = await newInstance();
    const second = await newInstance();

    // Ten anonymous messages is the whole hourly allowance; split them over
    // two instances. Per-instance counting would allow all ten on each.
    for (let i = 0; i < 5; i++) {
      expect((await first.checkChatRateLimit('203.0.113.7', false)).allowed).toBe(true);
    }
    for (let i = 0; i < 5; i++) {
      expect((await second.checkChatRateLimit('203.0.113.7', false)).allowed).toBe(true);
    }

    expect((await first.checkChatRateLimit('203.0.113.7', false)).allowed).toBe(false);
    expect((await second.checkChatRateLimit('203.0.113.7', false)).allowed).toBe(false);
  });

  it('reports the allowance it has left, and none once it is spent', async () => {
    const { checkChatRateLimit, CHAT_RATE_LIMITS } = await newInstance();

    const first = await checkChatRateLimit('203.0.113.7', false);
    expect(first).toMatchObject({
      allowed: true,
      remaining: CHAT_RATE_LIMITS.anonymous.maxRequests - 1,
      limit: CHAT_RATE_LIMITS.anonymous.maxRequests,
    });

    for (let i = 1; i < CHAT_RATE_LIMITS.anonymous.maxRequests; i++) {
      await checkChatRateLimit('203.0.113.7', false);
    }
    expect(await checkChatRateLimit('203.0.113.7', false)).toMatchObject({ allowed: false, remaining: 0 });
  });

  it('keeps the window fixed, so a caller who keeps asking cannot push the reset back', async () => {
    const { checkChatRateLimit } = await newInstance();

    const start = (await checkChatRateLimit('203.0.113.7', false)).resetTime.getTime();
    vi.advanceTimersByTime(30 * 60 * 1000);
    expect((await checkChatRateLimit('203.0.113.7', false)).resetTime.getTime()).toBe(start);

    // Past the hour the window reopens with the full allowance.
    vi.advanceTimersByTime(31 * 60 * 1000);
    const reopened = await checkChatRateLimit('203.0.113.7', false);
    expect(reopened.allowed).toBe(true);
    expect(reopened.resetTime.getTime()).toBeGreaterThan(start);
  });

  it('counts a signed-in user against the higher limit, in a bucket of their own', async () => {
    const { checkChatRateLimit, CHAT_RATE_LIMITS } = await newInstance();

    for (let i = 0; i < CHAT_RATE_LIMITS.anonymous.maxRequests; i++) {
      await checkChatRateLimit('203.0.113.7', false);
    }
    expect((await checkChatRateLimit('203.0.113.7', false)).allowed).toBe(false);

    const signedIn = await checkChatRateLimit('user-1', true);
    expect(signedIn).toMatchObject({
      allowed: true,
      limit: CHAT_RATE_LIMITS.authenticated.maxRequests,
    });
    expect(evals).toContain('chat-ratelimit:v1:anon:203.0.113.7');
    expect(evals).toContain('chat-ratelimit:v1:auth:user-1');
  });

  it('counts in this instance when Redis is not configured', async () => {
    redisUp.on = false;
    const { checkChatRateLimit, CHAT_RATE_LIMITS } = await newInstance();

    for (let i = 0; i < CHAT_RATE_LIMITS.anonymous.maxRequests; i++) {
      expect((await checkChatRateLimit('203.0.113.7', false)).allowed).toBe(true);
    }
    expect((await checkChatRateLimit('203.0.113.7', false)).allowed).toBe(false);
    expect(evals).toHaveLength(0);
  });

  it('counts in this instance when Redis fails, rather than throwing or serving unmetered', async () => {
    redisUp.throws = true;
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { checkChatRateLimit, CHAT_RATE_LIMITS } = await newInstance();

    for (let i = 0; i < CHAT_RATE_LIMITS.anonymous.maxRequests; i++) {
      expect((await checkChatRateLimit('203.0.113.7', false)).allowed).toBe(true);
    }
    expect((await checkChatRateLimit('203.0.113.7', false)).allowed).toBe(false);
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it('leaves a developer on loopback unmetered, as before', async () => {
    vi.stubEnv('NODE_ENV', 'development');
    const { checkChatRateLimit, CHAT_RATE_LIMITS } = await newInstance();

    for (let i = 0; i < CHAT_RATE_LIMITS.anonymous.maxRequests + 5; i++) {
      expect((await checkChatRateLimit('127.0.0.1', false)).allowed).toBe(true);
    }
    expect(evals).toHaveLength(0);
  });
});

describe('createRateLimitHeaders', () => {
  it('states the limit, what is left and when the window resets', async () => {
    const { checkChatRateLimit, createRateLimitHeaders } = await newInstance();

    const result = await checkChatRateLimit('203.0.113.7', false);
    const headers = createRateLimitHeaders(result) as Record<string, string>;

    expect(headers['X-RateLimit-Limit']).toBe('10');
    expect(headers['X-RateLimit-Remaining']).toBe('9');
    expect(headers['X-RateLimit-Reset']).toBe(String(Math.floor(result.resetTime.getTime() / 1000)));
  });
});
