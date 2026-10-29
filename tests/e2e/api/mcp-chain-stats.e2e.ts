import { describe, expect, test } from 'e2e';
import { z } from 'zod';
import { callTool } from './mcp-call';

// chain_stats reads the public Stats API (stats-api.avax.network), which serves closed periods only.

const ChainSeries = z.object({
  source: z.literal('stats-api'),
  target: z.literal('chain'),
  chainId: z.literal(43114),
  timeInterval: z.literal('day'),
  days: z.literal(7),
  series: z.array(z.object({ timestamp: z.number(), txCount: z.number() }).passthrough()),
});

const ChainRecent = z.object({
  source: z.literal('stats-api'),
  target: z.literal('chain'),
  chainId: z.literal(43114),
  windowHours: z.literal(24),
  metrics: z.object({ txCount: z.number() }).passthrough(),
});

// API tests run once, on the target without a browser engine (platform "api").
describe('MCP chain_stats', { platforms: ['api'], tags: ['api', 'mcp'] }, () => {
  test('target=contract explains that per-contract stats moved to the Query page', async ({ app }) => {
    const res = await callTool(app, 'chain_stats', { target: 'contract', chainId: 43114, value: '0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7' });
    expect(res.isError).toBe(true);
    expect(res.text).toMatch(/explorer\/mainnet\/query/);
  });

  test('series rejects days over 365 with a validation error', async ({ app }) => {
    const res = await callTool(app, 'chain_stats', {
      target: 'chain',
      window: 'series',
      chainId: 43114,
      days: 366,
      timeInterval: 'day',
    });
    expect(res.isError).toBe(true);
    expect(res.text).toMatch(/days must be an integer 1\.\.365/);
  });

  test('series rejects an hourly series over 90 days', async ({ app }) => {
    const res = await callTool(app, 'chain_stats', {
      target: 'chain',
      window: 'series',
      chainId: 43114,
      days: 91,
      timeInterval: 'hour',
    });
    expect(res.isError).toBe(true);
    expect(res.text).toMatch(/at most 90 days/);
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
    const answer = expect(res.json).toMatchSchema(ChainSeries);
    expect(answer.series.length).toBeGreaterThan(0);
  });

  test('recent sums the closed hours of the window', async ({ app }) => {
    const res = await callTool(app, 'chain_stats', { target: 'chain', chainId: 43114, hours: 24 });
    expect(res.isError, res.text).toBe(false);
    const answer = expect(res.json).toMatchSchema(ChainRecent);
    expect(answer.metrics.txCount).toBeGreaterThan(0);
  });
});
