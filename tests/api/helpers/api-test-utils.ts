/**
 * Core test utilities for API route testing.
 *
 * Provides helpers to construct NextRequest objects, call route handlers,
 * and assert against the standard API response envelope used by Builders Hub.
 *
 * Response envelope:
 *   Success:   { success: true,  data: T }
 *   Paginated: { success: true,  data: T[], pagination: { page, pageSize, total } }
 *   Error:     { success: false, error: { code: string, message: string } }
 */

import { NextRequest } from 'next/server';
import { expect } from 'vitest';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Parsed result returned by callHandler. */
export interface HandlerResult {
  status: number;
  body: any;
  headers: Headers;
}

/** Shape of a successful (non-paginated) API response. */
export interface SuccessBody<T = any> {
  success: true;
  data: T;
}

/** Shape of a paginated API response. */
export interface PaginatedBody<T = any> {
  success: true;
  data: T[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
  };
}

/** Shape of an error API response. */
export interface ErrorBody {
  success: false;
  error: {
    code: string;
    message: string;
  };
}

/** Standard error codes used by the API layer. */
export type ApiErrorCode =
  | 'VALIDATION_ERROR'
  | 'BAD_REQUEST'
  | 'AUTH_REQUIRED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'RATE_LIMITED'
  | 'INTERNAL_ERROR';

// ---------------------------------------------------------------------------
// Request builder
// ---------------------------------------------------------------------------

/**
 * Create a mock NextRequest for testing API routes.
 *
 * @param method  - HTTP method (GET, POST, PUT, DELETE, PATCH, etc.)
 * @param options - Optional body, headers, searchParams, and base URL.
 * @returns A real NextRequest instance ready to pass to a route handler.
 *
 * @example
 * ```ts
 * const req = createMockRequest('POST', {
 *   body: { name: 'foo' },
 *   headers: { 'x-custom': 'bar' },
 *   searchParams: { page: '1' },
 * });
 * ```
 */
export function createMockRequest(
  method: string,
  options?: {
    body?: any;
    headers?: Record<string, string>;
    searchParams?: Record<string, string>;
    url?: string;
  },
): NextRequest {
  const baseUrl = options?.url ?? 'http://localhost:3000/api/test';
  const url = new URL(baseUrl);

  if (options?.searchParams) {
    for (const [key, value] of Object.entries(options.searchParams)) {
      url.searchParams.set(key, value);
    }
  }

  const headers = new Headers(options?.headers);

  const init: Record<string, unknown> = { method, headers };

  if (options?.body !== undefined) {
    init.body = JSON.stringify(options.body);
    // Set Content-Type if the caller didn't provide one.
    if (!headers.has('Content-Type')) {
      headers.set('Content-Type', 'application/json');
    }
  }

  // Next.js's RequestInit is stricter than the standard DOM type (signal
  // must be undefined, not null). The cast is safe for test construction.
  return new NextRequest(url, init as any);
}

// ---------------------------------------------------------------------------
// Handler caller
// ---------------------------------------------------------------------------

/**
 * Call an API route handler and parse the response.
 *
 * Handles the Next.js App Router route handler signature:
 *   (request: NextRequest, context: { params: Promise<Record<string, string>> }) => Response
 *
 * @param handler - The route handler function (e.g. GET, POST exported from a route file).
 * @param request - The NextRequest to pass.
 * @param params  - Optional dynamic route params (e.g. `{ id: '123' }`).
 * @returns Parsed status, JSON body, and response headers.
 *
 * @example
 * ```ts
 * const { GET } = await import('@/app/api/projects/route');
 * const result = await callHandler(GET, req, { id: '123' });
 * ```
 */
export async function callHandler(
  handler: Function,
  request: NextRequest,
  params?: Record<string, string>,
): Promise<HandlerResult> {
  const context = { params: Promise.resolve(params ?? {}) };
  const response: Response = await handler(request, context);

  let body: any;
  try {
    body = await response.json();
  } catch {
    body = null;
  }

  return {
    status: response.status,
    body,
    headers: response.headers,
  };
}

// ---------------------------------------------------------------------------
// Assertion helpers
// ---------------------------------------------------------------------------

/**
 * Assert a successful API response with the correct envelope.
 *
 * Verifies:
 * - `result.status` matches `expectedStatus` (default 200)
 * - `result.body.success` is `true`
 * - `result.body.data` exists
 *
 * @returns `result.body.data` for further assertions.
 *
 * @example
 * ```ts
 * const data = expectSuccess(result, 201);
 * expect(data.name).toBe('Test');
 * ```
 */
export function expectSuccess<T = any>(
  result: HandlerResult,
  expectedStatus = 200,
): T {
  expect(result.status).toBe(expectedStatus);
  expect(result.body.success).toBe(true);
  expect(result.body).toHaveProperty('data');
  return result.body.data as T;
}

/**
 * Assert a paginated API response.
 *
 * Verifies everything `expectSuccess` checks plus:
 * - `result.body.pagination` exists with `page`, `pageSize`, and `total` properties.
 * - `result.body.data` is an array.
 *
 * @returns An object containing `data` and `pagination` for further assertions.
 *
 * @example
 * ```ts
 * const { data, pagination } = expectPaginated(result);
 * expect(data).toHaveLength(10);
 * expect(pagination.total).toBe(42);
 * ```
 */
export function expectPaginated<T = any>(
  result: HandlerResult,
): { data: T[]; pagination: { page: number; pageSize: number; total: number } } {
  expect(result.status).toBe(200);
  expect(result.body.success).toBe(true);
  expect(result.body).toHaveProperty('data');
  expect(Array.isArray(result.body.data)).toBe(true);

  expect(result.body).toHaveProperty('pagination');
  expect(result.body.pagination).toHaveProperty('page');
  expect(result.body.pagination).toHaveProperty('pageSize');
  expect(result.body.pagination).toHaveProperty('total');

  return {
    data: result.body.data as T[],
    pagination: result.body.pagination,
  };
}

/**
 * Assert an error API response with the correct envelope.
 *
 * Verifies:
 * - `result.status` matches `expectedStatus`
 * - `result.body.success` is `false`
 * - `result.body.error` has `code` and `message` string properties
 * - If `expectedCode` is provided, `result.body.error.code` matches it.
 *
 * @returns The error object `{ code, message }` for further assertions.
 *
 * @example
 * ```ts
 * const err = expectError(result, 401, 'AUTH_REQUIRED');
 * expect(err.message).toContain('authentication');
 * ```
 */
export function expectError(
  result: HandlerResult,
  expectedStatus: number,
  expectedCode?: string,
): { code: string; message: string } {
  expect(result.status).toBe(expectedStatus);
  expect(result.body.success).toBe(false);
  expect(result.body).toHaveProperty('error');
  expect(typeof result.body.error.code).toBe('string');
  expect(typeof result.body.error.message).toBe('string');

  if (expectedCode !== undefined) {
    expect(result.body.error.code).toBe(expectedCode);
  }

  return result.body.error as { code: string; message: string };
}
