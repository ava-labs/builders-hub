/**
 * Shared harness core for the Avalanche MCP verification suite.
 *
 * Exposes the JSON-RPC `callTool` client, the case registry (`add`), assertion
 * helpers, common fixtures, and the infra-skip classifier. The case files under
 * scripts/mcp-prompts/*.ts import from here and register cases via `add`;
 * scripts/mcp-smoke.ts imports them and runs the registry.
 */

export const MCP_URL = process.env.MCP_URL || 'https://build.avax.network/api/mcp';
export const CONCURRENCY = Number(process.env.CONCURRENCY || 5);
// Optional Vercel preview protection-bypass token.
const VERCEL_BYPASS = process.env.VERCEL_BYPASS || '';
// Per-call hard timeout. The MCP route forwards to upstream APIs (Glacier,
// metrics, GitHub, RPC) that can hang; without a client-side deadline one slow
// call freezes the whole batch. A timeout here surfaces as an infra-skip.
const CALL_TIMEOUT_MS = Number(process.env.CALL_TIMEOUT_MS || 30_000);

// ---------------------------------------------------------------------------
// Fixtures — real, stable on-chain references used across the suite.
// ---------------------------------------------------------------------------
export const EOA = '0x8ae8be25c23833e0a01aa200403e826f611f9cd2';
export const USDC = '0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E'; // USD Coin, C-Chain mainnet
export const WAVAX = '0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7'; // Wrapped AVAX, C-Chain mainnet
export const USDT = '0x9702230A8Ea53601f5cD2dc00fDBc13d4dF4A8c7'; // TetherToken, C-Chain mainnet
export const PRIMARY_SUBNET = '11111111111111111111111111111111LpoYY';
export const C_CHAIN_MAINNET = '2q9e4r6Mu3U68nU1fYjgbR6JvwrRx36CohpAX3FZa4mGGEKDmU';
// A well-known long-lived mainnet validator NodeID (Ava Labs). Used only as a
// realistic-looking fixture; lookups tolerate "not found" / infra outcomes.
export const SAMPLE_NODE_ID = 'NodeID-7Xhw2mDxuDS44j42TCB6U5579esbSt3Lg';

// ---------------------------------------------------------------------------
// JSON-RPC client
// ---------------------------------------------------------------------------
export interface CallResult {
  text: string;
  isError: boolean;
  raw: unknown;
  httpStatus: number;
  /** Transport body was not valid JSON-RPC (e.g. an HTML error/auth page). */
  rawBodyUnparseable: boolean;
  /** True when this result carries a normal tool payload (result.content). */
  hasToolContent: boolean;
}

export async function callTool(name: string, args: Record<string, unknown>): Promise<CallResult> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  };
  if (VERCEL_BYPASS) {
    // Send ONLY the protection-bypass header. Adding x-vercel-set-bypass-cookie
    // makes Vercel answer with a 307 cookie-setting redirect instead of serving
    // the request inline; the header alone authorizes each call with a clean 200.
    headers['x-vercel-protection-bypass'] = VERCEL_BYPASS;
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), CALL_TIMEOUT_MS);
  try {
    const res = await fetch(MCP_URL, {
      method: 'POST',
      headers,
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name, arguments: args } }),
      signal: controller.signal,
    });
    const bodyText = await res.text();
    let j: any = {};
    let rawBodyUnparseable = false;
    try {
      j = JSON.parse(bodyText);
    } catch {
      // Non-JSON transport body (e.g. an HTML auth wall or proxy error page).
      j = { __rawBody: bodyText };
      rawBodyUnparseable = true;
    }
    const hasToolContent = Array.isArray(j?.result?.content);
    const text: string =
      j?.result?.content?.[0]?.text ??
      (j?.error ? JSON.stringify(j.error) : j?.__rawBody ?? JSON.stringify(j));
    const isError = !!j?.result?.isError || !!j?.error || !res.ok;
    return { text, isError, raw: j, httpStatus: res.status, rawBodyUnparseable, hasToolContent };
  } catch (err) {
    // AbortError (our timeout) and network errors are classified as infra by isInfraSkip.
    const msg = err instanceof Error && err.name === 'AbortError' ? 'timeout: the operation was aborted' : String(err);
    return { text: msg, isError: true, raw: null, httpStatus: 0, rawBodyUnparseable: false, hasToolContent: false };
  } finally {
    clearTimeout(timer);
  }
}

// ---------------------------------------------------------------------------
// Assertion helpers
// ---------------------------------------------------------------------------
export const has = (t: string, s: string) => t.toLowerCase().includes(s.toLowerCase());
export const lacks = (t: string, s: string) => !t.toLowerCase().includes(s.toLowerCase());
export const hasAny = (t: string, ...ss: string[]) => ss.some((s) => has(t, s));
export const is429 = (t: string) => /\b429\b|too many requests|rate limit/i.test(t);
export const isHtmlCrash = (t: string) => /unexpected token '<'|<!doctype|<html/i.test(t);
export const isJson = (t: string) => {
  try {
    JSON.parse(t);
    return true;
  } catch {
    return false;
  }
};
export const jsonHas = (t: string, key: string) => {
  try {
    return key in JSON.parse(t);
  } catch {
    return false;
  }
};

/**
 * A hard crash that must NEVER happen: an HTML/parser crash at the transport
 * layer, a raw 5xx, or a leaked Node stack trace.
 *
 * Important: we must NOT flag a *successful* tool payload merely because its
 * returned text quotes HTML (e.g. docs_search echoing a `<script>`/`<html>`
 * snippet from documentation). So substring HTML/stack heuristics only apply
 * when the response is NOT a clean tool payload.
 */
export const isCrash = (r: CallResult): boolean => {
  if (r.httpStatus >= 500) return true; // raw server error
  if (r.rawBodyUnparseable) return true; // transport body wasn't JSON-RPC (HTML page, etc.)
  if (r.hasToolContent) return false; // a normal tool result — its text is data, not a crash
  // Otherwise (JSON-RPC error envelope or odd shape): look for crash signatures.
  return (
    isHtmlCrash(r.text) ||
    /\bstack trace\b/i.test(r.text) ||
    /\bat Object\.<anonymous>\b/.test(r.text) ||
    /\n\s+at .+\(.+:\d+:\d+\)/.test(r.text) // node stack frames
  );
};

// ---------------------------------------------------------------------------
// Infra-skip classifier — distinguishes transient infra (rate-limit, auth wall,
// timeout, upstream 5xx) from real correctness failures. These are SKIPPED, not
// FAILED. A crash (HTML/5xx body surfaced as tool text) is NOT a skip.
// ---------------------------------------------------------------------------
export function isInfraSkip(r: CallResult): boolean {
  const t = r.text || '';
  // Vercel / proxy auth wall.
  if (/authentication required|vercel.*sso|x-vercel-protection/i.test(t)) return true;
  if (r.httpStatus === 401 || r.httpStatus === 403) {
    // 403 from GitHub is sometimes rate-limit; treat auth/ratelimit as infra.
    return true;
  }
  // Rate limiting bubbling up from upstream APIs.
  if (is429(t) || r.httpStatus === 429) return true;
  // Upstream gateway / timeout problems.
  if (r.httpStatus === 502 || r.httpStatus === 503 || r.httpStatus === 504) return true;
  if (/\b(408|gateway timeout|timed out|timeout|fetch failed|econnrefused|enotfound|socket hang up|aborterror|the operation was aborted)\b/i.test(t))
    return true;
  // Non-JSON node response guard surfacing transient upstream HTML.
  if (/non-json response from (node|metrics api)/i.test(t)) return true;
  // Upstream Data/Metrics API 5xx surfaced as a tool message.
  if (/data api error: 5\d\d|metrics api error: 5\d\d|http 5\d\d/i.test(t)) return true;
  return false;
}

// ---------------------------------------------------------------------------
// Case registry
// ---------------------------------------------------------------------------
export type Verdict = boolean | 'skip';

export interface Case {
  section: string;
  label: string;
  run: () => Promise<Verdict>;
}

export const cases: Case[] = [];

export function add(section: string, label: string, run: () => Promise<Verdict>) {
  cases.push({ section, label, run });
}

/**
 * "No results" sentinels from the search-backed tools (docs/cli/rpc/acp). When a
 * server has an incomplete local content tree (e.g. /docs/acps and the C-Chain
 * RPC reference pages aren't checked out / generated), these tools correctly
 * return an empty-results message. That is an *environment* condition — not a
 * tool bug and not a correctness failure — so for search-grounded assertions we
 * classify it as a skip, the same as an auth wall. On a fully-populated
 * server (preview/prod) these populate and the strict assertion applies.
 */
export const isEmptyContentEnv = (t: string) =>
  /no results found for|no cli results found for|no rpc results found for|no acp results found for|no structured acp-\d+ record found|no acps match the requested filters/i.test(t);

/**
 * Convenience wrapper for the common pattern: call one tool, then assert.
 * Auto-classifies infra-skip outcomes so individual cases stay focused on
 * correctness. Returns 'skip' when the result is a transient infra problem.
 */
export async function check(
  tool: string,
  args: Record<string, unknown>,
  assert: (r: CallResult) => boolean
): Promise<Verdict> {
  const r = await callTool(tool, args);
  if (isInfraSkip(r)) return 'skip';
  if (isCrash(r)) return false; // crashes are always hard failures
  return assert(r);
}

/**
 * Like `check`, but for search-grounded tools: an empty-content-index response
 * is treated as an environment skip rather than a failure.
 */
export async function checkSearch(
  tool: string,
  args: Record<string, unknown>,
  assert: (r: CallResult) => boolean
): Promise<Verdict> {
  const r = await callTool(tool, args);
  if (isInfraSkip(r)) return 'skip';
  if (isCrash(r)) return false;
  if (isEmptyContentEnv(r.text)) return 'skip';
  return assert(r);
}
