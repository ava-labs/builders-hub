/**
 * API-level e2e for the MCP tool endpoint (`/api/mcp`).
 *
 * Unlike the browser smoke/flow specs, these hit the JSON-RPC endpoint
 * directly (Playwright's `request` fixture) and assert on the tool response
 * envelope — no wallet shim needed. They lock in the correctness fixes made to
 * the data/blockchain tools so a regression turns CI red instead of silently
 * shipping a wrong or dishonest answer:
 *
 *   - a numeric EVM chainId resolves to the RIGHT network (43113=Fuji,
 *     43114=Mainnet) — never a silent mainnet default;
 *   - VM names + explorer slugs are the real ones (X-Chain=AVM, C-Chain=Coreth);
 *   - the P-Chain resolves via its canned record (it isn't in getBlockchains);
 *   - the primary-network subnet id classifies as a subnet, not a chain;
 *   - per-contract chain_stats discloses that window:series/hours don't apply
 *     instead of silently returning the default-window aggregate;
 *   - an out-of-range `days` returns an honest validation error, NOT a false
 *     "gateway unreachable" Glacier fallback.
 *
 * Target + auth come from the shared harness env (see e2e/README.md):
 *   QA_TARGET_URL                    base URL (default http://localhost:3000)
 *   VERCEL_AUTOMATION_BYPASS_SECRET  unlocks SSO-protected preview deploys
 *
 * If the target is a protected Vercel preview and no bypass secret is set, the
 * suite skips (green) rather than red-flagging the PR — mirroring the harness
 * convention for the browser tiers.
 */

import { test, expect, type APIRequestContext, type APIResponse } from '@playwright/test';

const BYPASS = process.env.VERCEL_AUTOMATION_BYPASS_SECRET;
const TARGET = process.env.QA_TARGET_URL ?? 'http://localhost:3000';
const PROTECTED_PREVIEW = /vercel\.app/i.test(TARGET) && !BYPASS;

/** The primary-network subnet id (also the P-Chain blockchain id). */
const PRIMARY_SUBNET = '11111111111111111111111111111111LpoYY';
/** WAVAX on C-Chain mainnet — a high-traffic contract with real stats. */
const WAVAX = '0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7';

interface ToolResult {
  status: number;
  /** JSON-RPC result.isError — a tool-level (not transport) error. */
  isError: boolean;
  /** The parsed tool envelope, or null when the tool text isn't JSON. */
  env: Record<string, any> | null;
  /** Raw inner tool text (the validation message on an error). */
  text: string;
}

/**
 * Invoke one MCP tool and unwrap the response. The endpoint answers as an SSE
 * stream (`data: {json}`) or plain JSON; handle both. The gateway enforces a
 * shared per-minute cost budget, so retry a couple of times on 429 with
 * backoff to keep the suite deterministic rather than rate-limit-flaky.
 */
async function callTool(
  request: APIRequestContext,
  name: string,
  args: Record<string, unknown>,
): Promise<ToolResult> {
  const headers: Record<string, string> = {
    'content-type': 'application/json',
    accept: 'application/json, text/event-stream',
  };
  if (BYPASS) headers['x-vercel-protection-bypass'] = BYPASS;
  const data = { jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name, arguments: args } };

  let res!: APIResponse;
  for (let attempt = 0; attempt < 3; attempt++) {
    res = await request.post('/api/mcp', { headers, data });
    if (res.status() !== 429) break;
    await new Promise((r) => setTimeout(r, 3000 * (attempt + 1)));
  }

  const raw = await res.text();
  const line = raw.split('\n').find((l) => l.startsWith('data:')) ?? raw;
  let outer: any = null;
  try {
    outer = JSON.parse(line.replace(/^data:/, '').trim());
  } catch {
    /* leave outer null — assertion below surfaces the raw text */
  }
  const inner: string = outer?.result?.content?.[0]?.text ?? '';
  let env: Record<string, any> | null = null;
  try {
    env = JSON.parse(inner);
  } catch {
    /* non-json tool text (e.g. an error message) */
  }
  return { status: res.status(), isError: outer?.result?.isError === true, env, text: inner || raw };
}

test.describe('MCP tools — data & blockchain lookups', () => {
  test.skip(
    PROTECTED_PREVIEW,
    'Vercel preview is SSO-protected and VERCEL_AUTOMATION_BYPASS_SECRET is unset',
  );

  test('chainId 43113 resolves to Fuji (not a silent mainnet default)', async ({ request }) => {
    const { status, env } = await callTool(request, 'blockchain_lookup_chain', { chainId: 43113 });
    expect(status).toBe(200);
    expect(env?.found).toBe(true);
    expect(String(env?.network)).toMatch(/fuji/i);
    expect(env?.vmName).toBe('Coreth (C-Chain, EVM)');
    expect(env?.explorerUrl).toContain('explorer-test.avax.network/c-chain');
  });

  test('chainId 43114 resolves to Mainnet with the C-Chain explorer', async ({ request }) => {
    const { status, env } = await callTool(request, 'blockchain_lookup_chain', { chainId: 43114 });
    expect(status).toBe(200);
    expect(env?.found).toBe(true);
    expect(env?.network).toBe('Mainnet');
    expect(env?.vmName).toBe('Coreth (C-Chain, EVM)');
    expect(env?.explorerUrl).toBe('https://explorer.avax.network/c-chain');
  });

  test('X-Chain reports the AVM vm name and x-chain explorer', async ({ request }) => {
    const { status, env } = await callTool(request, 'blockchain_lookup_chain', { name: 'X-Chain' });
    expect(status).toBe(200);
    expect(env?.found).toBe(true);
    expect(env?.vmName).toBe('AVM (X-Chain)');
    expect(env?.explorerUrl).toContain('/x-chain');
  });

  test('P-Chain resolves via its canned record (not in getBlockchains)', async ({ request }) => {
    const { status, env } = await callTool(request, 'blockchain_lookup_chain', { name: 'P-Chain' });
    expect(status).toBe(200);
    expect(env?.found).toBe(true);
    expect(env?.vmID).toBe('platformvm');
    expect(env?.vmName).toBe('Platform VM (P-Chain)');
    expect(env?.explorerUrl).toContain('/p-chain');
    expect(env?.note).toBeTruthy();
  });

  test('blockchain_lookup_chain honestly reports not-found for an unknown id', async ({ request }) => {
    const { status, env } = await callTool(request, 'blockchain_lookup_chain', { chainId: 999999 });
    expect(status).toBe(200);
    expect(env?.found).toBe(false);
  });

  test('onchain_lookup classifies the primary subnet id as a subnet', async ({ request }) => {
    const { status, env } = await callTool(request, 'onchain_lookup', { value: PRIMARY_SUBNET });
    expect(status).toBe(200);
    expect(env?.kind).toBe('subnet');
  });

  test('chain_stats target=contract discloses that window/hours do not apply', async ({ request }) => {
    const { status, isError, env } = await callTool(request, 'chain_stats', {
      target: 'contract',
      window: 'series',
      chainId: 43114,
      value: WAVAX,
      days: 90,
      timeInterval: 'day',
    });
    expect(status).toBe(200);
    expect(isError).toBe(false);
    expect(env?.paramNote).toBeTruthy();
    expect(String(env?.paramNote)).toMatch(/not applied/i);
  });

  test('chain_stats series rejects an over-max days with an honest error (no false fallback)', async ({
    request,
  }) => {
    const { isError, env, text } = await callTool(request, 'chain_stats', {
      target: 'chain',
      window: 'series',
      chainId: 43114,
      days: 366,
      timeInterval: 'day',
    });
    expect(isError).toBe(true);
    expect(text).toMatch(/days must be an integer 1\.\.365/);
    // Must NOT masquerade as a gateway outage.
    expect(env?.source).not.toBe('glacier-fallback');
  });

  test('chain_stats series returns a real time-series for a valid window', async ({ request }) => {
    const { status, isError, env } = await callTool(request, 'chain_stats', {
      target: 'chain',
      window: 'series',
      chainId: 43114,
      days: 7,
      timeInterval: 'day',
    });
    expect(status).toBe(200);
    expect(isError).toBe(false);
    expect(env?.source).not.toBe('glacier-fallback');
    expect(Array.isArray(env?.series)).toBe(true);
  });
});
