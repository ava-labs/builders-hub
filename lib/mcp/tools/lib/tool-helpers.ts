/**
 * Small formatting/validation helpers shared across MCP tool domains. Each of
 * these used to be redefined (sometimes with subtly different behavior) in
 * two or more of the tool files; this is the single copy.
 */

import type { ToolResult } from '../../types';

export function getString(args: Record<string, unknown>, key: string, fallback = ''): string {
  const v = args[key];
  return typeof v === 'string' && v.trim() ? v.trim() : fallback;
}

export function errorResult(message: string): ToolResult {
  return { content: [{ type: 'text', text: message }], isError: true };
}

/**
 * Allowlist guard for enum args. An absent/blank arg → null (the caller's
 * default applies); a value outside the allowlist → a clean {isError} result
 * naming the allowed values. Chain calls with `||` and return the first non-null.
 */
export function rejectBadEnum(args: Record<string, unknown>, key: string, allowed: readonly string[]): ToolResult | null {
  const v = args[key];
  if (v === undefined || v === null || v === '') return null;
  const s = (typeof v === 'string' ? v : String(v)).trim();
  return s && !allowed.includes(s) ? errorResult(`Error: ${key} must be one of: ${allowed.join(', ')}.`) : null;
}

/** Turn a caught RPC/fetch error into an {isError} ToolResult, falling back for non-Error throws. */
export function rpcErrorResult(err: unknown, fallback: string): ToolResult {
  return { content: [{ type: 'text', text: err instanceof Error ? err.message : fallback }], isError: true };
}

// --- Pagination — list endpoints (platform.getBlockchains / getCurrentValidators
// / etc.) can return tens of thousands of entries, overflowing an MCP client's
// token budget. We slice the array field and attach pagination metadata. -------

export const DEFAULT_PAGE_SIZE = 50;
export const MAX_PAGE_SIZE = 200;

export const PAGINATION_PROPS = {
  limit: {
    type: 'number',
    minimum: 1,
    maximum: MAX_PAGE_SIZE,
    description: `Max items to return (default: ${DEFAULT_PAGE_SIZE}). Use with "offset" to page.`,
  },
  offset: {
    type: 'number',
    minimum: 0,
    description: 'Number of items to skip from the start (default: 0).',
  },
} as const;

export function clampInt(value: unknown, fallback: number, min: number, max: number): number {
  const n = typeof value === 'number' ? Math.floor(value) : fallback;
  return Math.min(Math.max(n, min), max);
}

/**
 * Slice the array under `arrayKey` according to limit/offset args and append a
 * `_pagination` summary. Non-array / non-object results pass through unchanged.
 */
export function paginateArrayField(result: unknown, arrayKey: string, args: Record<string, unknown>): unknown {
  if (!result || typeof result !== 'object') return result;
  const obj = result as Record<string, unknown>;
  const arr = obj[arrayKey];
  if (!Array.isArray(arr)) return result;

  const total = arr.length;
  const limit = clampInt(args.limit, DEFAULT_PAGE_SIZE, 1, MAX_PAGE_SIZE);
  const offset = clampInt(args.offset, 0, 0, Number.MAX_SAFE_INTEGER);
  const page = arr.slice(offset, offset + limit);

  return {
    ...obj,
    [arrayKey]: page,
    _pagination: {
      total,
      offset,
      limit,
      returned: page.length,
      hasMore: offset + page.length < total,
    },
  };
}
