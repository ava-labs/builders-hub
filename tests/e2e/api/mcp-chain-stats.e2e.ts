import { describe, expect, test } from 'e2e';
import { z } from 'zod';
import { callTool } from './mcp-call';

// WAVAX on the Mainnet C-Chain: a contract with traffic every day.
const WAVAX = '0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7';

// chain_stats reads indexed data through the query gateway. A server without MCP_GATEWAY_URL and
// MCP_GATEWAY_SECRET (a local dev server) cannot reach it. These are the errors for that case.
const GATEWAY_UNAVAILABLE = /gateway is not configured|gateway 5\d\d|fetch failed|aborted/i;

const ContractStats = z.object({
  source: z.string().min(1),
  target: z.literal('contract'),
  chainId: z.literal(43114),
  contract: z.literal(WAVAX.toLowerCase()),
  days: z.literal(90),
  paramNote: z.string(),
  stats: z.record(z.string(), z.unknown()),
});

const ChainSeries = z.object({
  source: z.string().min(1),
  target: z.literal('chain'),
  chainId: z.literal(43114),
  timeInterval: z.literal('day'),
  days: z.literal(7),
  series: z.array(z.record(z.string(), z.unknown())),
});

// The answer when the gateway is down: the latest block from Glacier, with no time window.
const GlacierFallback = z.object({
  source: z.literal('glacier-fallback'),
  target: z.literal('chain'),
  chainId: z.literal('43114'),
  note: z.string().regex(/unreachable/i),
  latestBlock: z.unknown(),
});

// API tests run once, on the target without a browser engine (platform "api").
describe('MCP chain_stats', { platforms: ['api'], tags: ['api', 'mcp'] }, () => {
  test('target=contract says that window=series does not apply', async ({ app }) => {
    const res = await callTool(app, 'chain_stats', {
      target: 'contract',
      window: 'series',
      chainId: 43114,
      value: WAVAX,
      days: 90,
      timeInterval: 'day',
    });
    test.skip(
      res.isError && GATEWAY_UNAVAILABLE.test(res.text),
      `the server cannot reach the query gateway ("${res.text.slice(0, 120)}"), so per-contract stats are not available`,
    );
    expect(res.isError, res.text).toBe(false);
    const stats = expect(res.json).toMatchSchema(ContractStats);
    expect(stats.paramNote).toMatch(/window:series was not applied/);
  });

  test('series rejects days over 365 with a validation error, not a gateway fallback', async ({ app }) => {
    const res = await callTool(app, 'chain_stats', {
      target: 'chain',
      window: 'series',
      chainId: 43114,
      days: 366,
      timeInterval: 'day',
    });
    expect(res.isError).toBe(true);
    expect(res.text).toMatch(/days must be an integer 1\.\.365/);
    expect((res.json as { source?: unknown } | undefined)?.source).not.toBe('glacier-fallback');
  });

  test('series returns a daily time series for a valid window', async ({ app }) => {
    const res = await callTool(app, 'chain_stats', {
      target: 'chain',
      window: 'series',
      chainId: 43114,
      days: 7,
      timeInterval: 'day',
    });
    expect(res.isError, res.text).toBe(false);
    const { source } = expect(res.json).toMatchSchema(z.object({ source: z.string().min(1) }));
    if (source === 'glacier-fallback') {
      // The fallback answer must still have its documented shape.
      expect(res.json).toMatchSchema(GlacierFallback);
      test.skip('the server cannot reach the query gateway, so chain_stats answered from the Glacier fallback');
    }
    const answer = expect(res.json).toMatchSchema(ChainSeries);
    expect(answer.series.length).toBeGreaterThan(0);
  });
});
